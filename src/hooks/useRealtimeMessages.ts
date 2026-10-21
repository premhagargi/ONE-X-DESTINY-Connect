"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import {
  REALTIME_EVENT_MESSAGE_CREATED,
  realtimeChannelForRoom,
  type ChatMessage,
  type HistoryPage,
  type PublicMessage,
} from "@/types/chat";

export type ConnectionStatus = "connecting" | "online" | "offline";

function byCreatedAt(a: ChatMessage, b: ChatMessage) {
  return a.createdAt.localeCompare(b.createdAt);
}

function generateClientKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers without crypto.randomUUID.
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Owns message state, the realtime subscription, optimistic sending, and
 * reconnect reconciliation for one room. See README "Real-time
 * architecture" for the delivery-strategy writeup this implements:
 *
 * 1. Optimistic rendering: sendMessage() appends a `status: "sending"`
 *    bubble immediately, before any network round trip.
 * 2. Server persistence: the message is POSTed to the API, which validates
 *    and writes it with Prisma.
 * 3. Realtime delivery to others: the server broadcasts the persisted row
 *    (see src/server/broadcast.ts); other clients' subscriptions here
 *    receive it.
 * 4. Reconciliation: the sender reconciles their own optimistic bubble
 *    against the *HTTP response*, not the broadcast — both paths funnel
 *    through the same upsertMessage() keyed by clientKey, so if the
 *    broadcast happens to arrive first (we don't disable `self` on the
 *    channel), it's a no-op upsert rather than a duplicate.
 * 5. Reconnection: on every (re)subscribe, we fetch anything created after
 *    the newest message we already have, so a gap from a dropped socket
 *    is closed from the database rather than assumed lost.
 */
export function useRealtimeMessages(params: {
  roomSlug: string;
  initialHistory: HistoryPage;
}) {
  const { roomSlug, initialHistory } = params;

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialHistory.messages.map((m) => ({ ...m, status: "sent" as const })),
  );
  const [nextCursor, setNextCursor] = useState<string | null>(initialHistory.nextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  // Newest *persisted* message id we've seen, for since= reconciliation.
  // A ref (not state) because it's write-heavy and read only inside
  // callbacks, never rendered directly.
  const latestPersistedRef = useRef<{ id: string; createdAt: string } | null>(
    initialHistory.messages.length
      ? {
          id: initialHistory.messages[initialHistory.messages.length - 1].id,
          createdAt: initialHistory.messages[initialHistory.messages.length - 1].createdAt,
        }
      : null,
  );

  const upsertMessage = useCallback((incoming: PublicMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.clientKey === incoming.clientKey);
      const next = idx === -1 ? [...prev, { ...incoming, status: "sent" as const }] : [...prev];
      if (idx !== -1) next[idx] = { ...incoming, status: "sent" };
      next.sort(byCreatedAt);
      return next;
    });

    const latest = latestPersistedRef.current;
    if (!latest || incoming.createdAt > latest.createdAt) {
      latestPersistedRef.current = { id: incoming.id, createdAt: incoming.createdAt };
    }
  }, []);

  const reconcile = useCallback(async () => {
    const latest = latestPersistedRef.current;
    if (!latest) return;
    try {
      const res = await fetch(
        `/api/rooms/${roomSlug}/messages?since=${encodeURIComponent(latest.id)}`,
      );
      if (!res.ok) return;
      const data: { messages: PublicMessage[] } = await res.json();
      for (const m of data.messages) upsertMessage(m);
    } catch {
      // Best-effort — if this fails we'll try again on the next reconnect,
      // or the reader can manually refresh.
    }
  }, [roomSlug, upsertMessage]);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase.channel(realtimeChannelForRoom(roomSlug));

    channel.on("broadcast", { event: REALTIME_EVENT_MESSAGE_CREATED }, ({ payload }) => {
      upsertMessage(payload as PublicMessage);
    });

    let hadDisconnect = false;

    channel.subscribe((subStatus) => {
      if (subStatus === "SUBSCRIBED") {
        setStatus("online");
        if (hadDisconnect) void reconcile();
        hadDisconnect = false;
      } else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT") {
        hadDisconnect = true;
        setStatus("offline");
      } else if (subStatus === "CLOSED") {
        hadDisconnect = true;
        setStatus((s) => (s === "online" ? "offline" : s));
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomSlug]);

  const sendMessage = useCallback(
    async (nickname: string, body: string) => {
      const clientKey = generateClientKey();
      const optimistic: ChatMessage = {
        id: clientKey,
        roomId: "",
        nickname,
        body,
        clientKey,
        createdAt: new Date().toISOString(),
        status: "sending",
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const res = await fetch(`/api/rooms/${roomSlug}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, clientKey }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessages((prev) =>
            prev.map((m) =>
              m.clientKey === clientKey ? { ...m, status: "failed" as const } : m,
            ),
          );
          return { ok: false as const, error: data.message ?? "Couldn't send. Try again." };
        }

        const data: { message: PublicMessage } = await res.json();
        upsertMessage(data.message);
        return { ok: true as const };
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.clientKey === clientKey ? { ...m, status: "failed" as const } : m)),
        );
        return { ok: false as const, error: "Connection problem. Check your network." };
      }
    },
    [roomSlug, upsertMessage],
  );

  /** Retries a failed send, reusing its original clientKey — if the
   * original request actually made it to the server despite the client
   * seeing a failure, the server's unique (roomId, clientKey) constraint
   * means this safely returns the already-persisted message instead of
   * creating a duplicate. */
  const retryMessage = useCallback(
    async (clientKey: string) => {
      const target = messages.find((m) => m.clientKey === clientKey);
      if (!target) return;

      setMessages((prev) =>
        prev.map((m) => (m.clientKey === clientKey ? { ...m, status: "sending" as const } : m)),
      );

      try {
        const res = await fetch(`/api/rooms/${roomSlug}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: target.body, clientKey }),
        });
        if (!res.ok) {
          setMessages((prev) =>
            prev.map((m) => (m.clientKey === clientKey ? { ...m, status: "failed" as const } : m)),
          );
          return;
        }
        const data: { message: PublicMessage } = await res.json();
        upsertMessage(data.message);
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.clientKey === clientKey ? { ...m, status: "failed" as const } : m)),
        );
      }
    },
    [messages, roomSlug, upsertMessage],
  );

  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/rooms/${roomSlug}/messages?before=${encodeURIComponent(nextCursor)}`,
      );
      if (!res.ok) return;
      const page: HistoryPage = await res.json();
      setMessages((prev) => {
        const existingKeys = new Set(prev.map((m) => m.clientKey));
        const older = page.messages
          .filter((m) => !existingKeys.has(m.clientKey))
          .map((m) => ({ ...m, status: "sent" as const }));
        return [...older, ...prev];
      });
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }, [nextCursor, loadingOlder, roomSlug]);

  return {
    messages,
    status,
    sendMessage,
    retryMessage,
    loadOlder,
    hasMoreOlder: !!nextCursor,
    loadingOlder,
  };
}
