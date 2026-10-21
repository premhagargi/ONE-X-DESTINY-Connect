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

/**
 * Deterministic compound comparator: sorts primarily by ISO createdAt timestamp,
 * with message ID as a stable tie-breaker for identical timestamps or optimistic
 * reconciliation.
 */
function byCreatedAt(a: ChatMessage, b: ChatMessage) {
  const cmp = a.createdAt.localeCompare(b.createdAt);
  if (cmp !== 0) return cmp;
  return a.id.localeCompare(b.id);
}

function generateClientKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Owns message state, the realtime subscription, optimistic sending, and
 * reconnect reconciliation for one room.
 *
 * 1. Optimistic rendering: sendMessage() appends a `status: "sending"`
 *    bubble immediately, before any network round trip.
 * 2. Server persistence: the message is POSTed to the API, which validates
 *    and writes it with Prisma.
 * 3. Realtime delivery to others: the server broadcasts the persisted row
 *    via Supabase Realtime; other clients' subscriptions receive it.
 * 4. Reconciliation: the sender reconciles their own optimistic bubble
 *    against the HTTP response.
 * 5. Reconnection & Tab Wake: handles online/offline and visibilitychange
 *    events to automatically recover missed messages after sleep/backgrounding.
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

  // Keep a stable ref to messages so callbacks like retryMessage don't invalidate
  // and trigger cascades of component re-renders.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Newest persisted message id we've seen, for since= reconciliation.
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
      let next: ChatMessage[];
      if (idx === -1) {
        next = [...prev, { ...incoming, status: "sent" as const }];
      } else {
        next = [...prev];
        next[idx] = { ...incoming, status: "sent" };
      }
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
      // Best-effort — if this fails we'll try again on next reconnect or wake
    }
  }, [roomSlug, upsertMessage]);

  // Handle network online/offline and tab visibility wake-ups
  useEffect(() => {
    function handleWakeup() {
      if (document.visibilityState === "visible") {
        void reconcile();
      }
    }

    function handleOnline() {
      setStatus("online");
      void reconcile();
    }

    function handleOffline() {
      setStatus("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleWakeup);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleWakeup);
    };
  }, [reconcile]);

  // Supabase Realtime channel subscription lifecycle
  useEffect(() => {
    const supabase = getSupabaseBrowser();

    if (!supabase) {
      // Safe fallback to auto-polling if Supabase Realtime keys are not configured
      setStatus("online");
      const pollTimer = setInterval(() => {
        void reconcile();
      }, 3500);
      return () => clearInterval(pollTimer);
    }

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
  }, [roomSlug, upsertMessage, reconcile]);

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

  /**
   * Retries a failed send, reusing its original clientKey.
   * Completely referentially stable across renders to avoid bust memoization.
   */
  const retryMessage = useCallback(
    async (clientKey: string) => {
      const target = messagesRef.current.find((m) => m.clientKey === clientKey);
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
    [roomSlug, upsertMessage],
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
