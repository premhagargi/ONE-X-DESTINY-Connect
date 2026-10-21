"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [shareCopied, setShareCopied] = useState(false);
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [myReactions, setMyReactions] = useState<Record<string, string[]>>({});
  const prevLastKeyRef = useRef<string | null>(null);
  const didInitialScroll = useRef(false);

  const handleToggleReaction = useCallback((messageId: string, emoji: string) => {
    setMyReactions((prev) => {
      const current = prev[messageId] || [];
      const hasReacted = current.includes(emoji);
      const next = hasReacted
        ? current.filter((e) => e !== emoji)
        : [...current, emoji];

      setReactions((rPrev) => {
        const msgReactions = { ...(rPrev[messageId] || {}) };
        if (hasReacted) {
          msgReactions[emoji] = Math.max(0, (msgReactions[emoji] || 1) - 1);
        } else {
          msgReactions[emoji] = (msgReactions[emoji] || 0) + 1;
        }
        return { ...rPrev, [messageId]: msgReactions };
      });

      return { ...prev, [messageId]: next };
    });
  }, []);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${room.name} — ONE-X-DESTINY Connect`,
          text: `Join the conversation in ${room.name} on ONE-X-DESTINY Connect!`,
          url,
        });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }

  // Initial load: land at the bottom once the first batch of history has laid out
  useEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [scrollToBottom]);

  // Follow new messages in, respecting the reader's current scroll position
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.clientKey === prevLastKeyRef.current) return;
    prevLastKeyRef.current = last.clientKey;
    onMessageArrived(last.nickname === nickname);
  }, [messages, nickname, onMessageArrived]);

  async function handleLoadOlder() {
    prepareForPrepend();
    await loadOlder();
    requestAnimationFrame(() => {
      restoreAfterPrepend();
    });
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

  // Precompute which messages are consecutive (same sender within 5 minutes)
  const rows = useMemo(
    () =>
      messages.map((m, idx) => {
        if (idx === 0) return { message: m, isConsecutive: false };
        const prev = messages[idx - 1];
        const isSameSender = prev.nickname === m.nickname;
        const timeDiff =
          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime();
        const isConsecutive = isSameSender && timeDiff < 1000 * 60 * 5;
        return { message: m, isConsecutive };
      }),
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
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-lg text-ink sm:text-xl">{room.name}</h1>
            <span
              title={status === "online" ? "Connected" : status === "connecting" ? "Connecting..." : "Offline"}
              className={`h-2 w-2 rounded-full shrink-0 ${
                status === "online"
                  ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                  : status === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-red-400"
              }`}
            />
          </div>
          <p className="truncate text-xs text-mist">
            You&apos;re <span className="font-medium text-harbor-dark">{nickname}</span> • {room.description}
          </p>
        </div>

        <button
          type="button"
          onClick={handleShare}
          title="Share room link"
          className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-horizon-50 px-3 text-xs font-medium text-ink-soft transition-colors hover:border-harbor hover:text-harbor-dark"
        >
          {shareCopied ? (
            <span className="text-harbor-dark font-semibold">Copied!</span>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span className="hidden sm:inline">Share</span>
            </>
          )}
        </button>
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
                className="rounded-full border border-line bg-card px-4 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-harbor disabled:opacity-50 shadow-2xs"
              >
                {loadingOlder ? "Loading…" : "Load earlier messages"}
              </button>
            </div>
          )}

          {messages.length === 0 && (
            <div className="my-auto flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-harbor-tint text-2xl">
                ✈️
              </div>
              <h2 className="mt-3 font-display text-xl text-ink">Welcome to {room.name}</h2>
              <p className="mt-1 max-w-xs text-sm text-mist">
                Nobody has posted yet. Say hello, ask a question, or share travel tips!
              </p>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            {rows.map(({ message: m, isConsecutive }) => {
              const isMine = m.nickname === nickname;
              return (
                <MessageBubble
                  key={m.clientKey}
                  message={m}
                  isMine={isMine}
                  isConsecutive={isConsecutive}
                  onRetry={retryMessage}
                  reactions={reactions[m.id]}
                  myReactions={myReactions[m.id]}
                  onToggleReaction={handleToggleReaction}
                />
              );
            })}
          </div>
        </div>

        {newBelowCount > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center z-10">
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:bg-ink-soft active:scale-95"
            >
              <span>{newBelowCount} new message{newBelowCount > 1 ? "s" : ""}</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v10M3 9l5 5 5-5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <Composer
        roomSlug={room.slug}
        onSend={handleSend}
        disabled={status === "offline"}
        disabledReason={
          status === "offline" ? "You're offline — reconnect to send messages." : undefined
        }
      />
    </div>
  );
}
