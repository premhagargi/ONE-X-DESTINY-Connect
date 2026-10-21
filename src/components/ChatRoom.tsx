"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import type { HistoryPage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { ConnectionBanner } from "./ConnectionBanner";

export function ChatRoom({
  room,
  nickname,
  initialHistory,
}: {
  room: { slug: string; name: string; description: string };
  nickname: string;
  initialHistory: HistoryPage;
}) {
  const router = useRouter();
  const {
    messages,
    status,
    sendMessage,
    retryMessage,
    loadOlder,
    hasMoreOlder,
    loadingOlder,
  } = useRealtimeMessages({ roomSlug: room.slug, initialHistory });

  const {
    containerRef,
    newBelowCount,
    scrollToBottom,
    onMessageArrived,
    prepareForPrepend,
    restoreAfterPrepend,
  } = useAutoScroll();

  const [leaving, setLeaving] = useState(false);
  const prevLastKeyRef = useRef<string | null>(null);
  const didInitialScroll = useRef(false);

  // Initial load: land at the bottom once the first batch of history has
  // laid out, rather than on mount (fonts can still be shifting layout at
  // that point).
  useEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    requestAnimationFrame(() => scrollToBottom("auto"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow new messages in, respecting the reader's current scroll
  // position (see useAutoScroll.onMessageArrived).
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.clientKey === prevLastKeyRef.current) return;
    prevLastKeyRef.current = last.clientKey;
    onMessageArrived(last.nickname === nickname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function handleLoadOlder() {
    prepareForPrepend();
    await loadOlder();
    requestAnimationFrame(restoreAfterPrepend);
  }

  async function handleSend(body: string) {
    return sendMessage(nickname, body);
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      await fetch(`/api/rooms/${room.slug}/leave`, { method: "POST" });
    } finally {
      router.push("/");
    }
  }

  // Precompute which bubbles should show a nickname label (the first
  // message in a run from a given sender), via an immutable reduce rather
  // than mutating a closure variable while mapping during render.
  const rows = useMemo(
    () =>
      messages.reduce<{ message: (typeof messages)[number]; showNickname: boolean }[]>(
        (acc, m) => {
          const prevNickname = acc.length ? acc[acc.length - 1].message.nickname : null;
          return [...acc, { message: m, showNickname: m.nickname !== prevNickname }];
        },
        [],
      ),
    [messages],
  );

  return (
    <div className="flex h-dvh flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaving}
          aria-label="Leave room and choose another"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-horizon disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M13 8H3M6.5 3.5 3 8l3.5 4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg text-ink sm:text-xl">{room.name}</h1>
          <p className="truncate text-xs text-mist">You&apos;re {nickname}</p>
        </div>
      </header>

      <ConnectionBanner status={status} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
        >
          {hasMoreOlder && (
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={handleLoadOlder}
                disabled={loadingOlder}
                className="rounded-full border border-line bg-card px-4 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-harbor disabled:opacity-50"
              >
                {loadingOlder ? "Loading…" : "Load earlier messages"}
              </button>
            </div>
          )}

          {messages.length === 0 && (
            <p className="mt-10 text-center text-sm text-mist">
              Nobody&apos;s said anything yet — be the first.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {rows.map(({ message: m, showNickname }) => {
              const isMine = m.nickname === nickname;
              return (
                <MessageBubble
                  key={m.clientKey}
                  message={m}
                  isMine={isMine}
                  showNickname={showNickname && !isMine}
                  onRetry={retryMessage}
                />
              );
            })}
          </div>
        </div>

        {newBelowCount > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="pointer-events-auto rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg transition-opacity hover:opacity-90"
            >
              {newBelowCount} new message{newBelowCount > 1 ? "s" : ""} ↓
            </button>
          </div>
        )}
      </div>

      <Composer
        onSend={handleSend}
        disabled={status === "offline"}
        disabledReason={
          status === "offline" ? "You're offline — reconnect to send messages." : undefined
        }
      />
    </div>
  );
}
