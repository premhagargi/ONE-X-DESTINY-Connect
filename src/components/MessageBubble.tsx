"use client";

import { memo, useCallback, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import { ReportButton } from "./ReportButton";

const AVATAR_PALETTE = [
  { bg: "bg-teal-100", text: "text-teal-800" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-indigo-100", text: "text-indigo-800" },
  { bg: "bg-emerald-100", text: "text-emerald-800" },
  { bg: "bg-rose-100", text: "text-rose-800" },
  { bg: "bg-sky-100", text: "text-sky-800" },
  { bg: "bg-orange-100", text: "text-orange-800" },
  { bg: "bg-purple-100", text: "text-purple-800" },
];

const avatarCache = new Map<string, { bg: string; text: string }>();
function getAvatarStyle(name: string) {
  const cached = avatarCache.get(name);
  if (cached) return cached;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const style = AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
  avatarCache.set(name, style);
  return style;
}

const timeCache = new Map<string, string>();
function formatTime(iso: string): string {
  const cached = timeCache.get(iso);
  if (cached) return cached;
  try {
    const formatted = new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    timeCache.set(iso, formatted);
    return formatted;
  } catch {
    return "";
  }
}

function renderMessageBody(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-harbor hover:underline font-medium break-all underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

const QUICK_ACTIONS = ["👍", "❤️", "✈️"];

export interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  isConsecutive: boolean;
  onRetry: (clientKey: string) => void;
  reactions?: Record<string, number>;
  myReactions?: string[];
  onToggleReaction?: (messageId: string, emoji: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
  isConsecutive,
  onRetry,
  reactions = {},
  myReactions = [],
  onToggleReaction,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const canReport = !isMine && message.status === "sent";
  const avatarStyle = getAvatarStyle(message.nickname);
  const initial = message.nickname.trim().charAt(0).toUpperCase();

  function handleCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(message.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  // Mobile Long-Press / Press-and-Hold Handling
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (message.status !== "sent") return;
      const touch = e.touches[0];
      if (!touch) return;
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      touchTimerRef.current = setTimeout(() => {
        setShowMobileActions(true);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(30);
          } catch {
            // Best effort
          }
        }
      }, 380); // 380ms press-and-hold trigger
    },
    [message.status],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !touchTimerRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    // If finger moves more than 8px, user is scrolling, so cancel long-press
    if (dx > 8 || dy > 8) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  const reactionEntries = Object.entries(reactions).filter(([, count]) => count > 0);

  return (
    <>
      {/* Mobile Backdrop to Dismiss on Tap Outside */}
      {showMobileActions && (
        <div
          className="fixed inset-0 z-20"
          onClick={(e) => {
            e.stopPropagation();
            setShowMobileActions(false);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setShowMobileActions(false);
          }}
        />
      )}

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(e) => {
          if (message.status === "sent") {
            e.preventDefault();
            setShowMobileActions(true);
          }
        }}
        className={`slack-msg-row group relative flex gap-3 px-3 sm:px-4 py-1.5 transition-colors rounded-xl font-sans tracking-tight select-none sm:select-text ${
          isConsecutive ? "mt-0.5" : "mt-2.5"
        } ${message.status === "failed" ? "opacity-60" : ""} ${
          showMobileActions
            ? "bg-horizon/90 ring-1 ring-harbor/40 shadow-xs z-30"
            : "hover:bg-horizon/50"
        }`}
      >
        {/* Left Avatar Gutter */}
        <div className="w-9 shrink-0 flex justify-center">
          {!isConsecutive ? (
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-2xs font-sans tracking-tight ${avatarStyle.bg} ${avatarStyle.text}`}
            >
              {initial}
            </span>
          ) : (
            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-mist transition-opacity self-start pt-1 font-mono tracking-tighter">
              {formatTime(message.createdAt).split(" ")[0]}
            </span>
          )}
        </div>

        {/* Message Content Area */}
        <div className="min-w-0 flex-1 relative">
          {!isConsecutive && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="font-sans font-semibold text-[13.5px] tracking-tight text-ink">
                {message.nickname}
              </span>
              {isMine && (
                <span className="font-sans rounded bg-harbor-tint px-1.5 py-0.2 text-[10px] font-semibold text-harbor-dark tracking-tight">
                  You
                </span>
              )}
              <span className="font-sans text-[11px] text-mist tracking-tight">
                {formatTime(message.createdAt)}
              </span>
            </div>
          )}

          {/* Message Body with tight Inter typography */}
          <div className="font-sans text-[14px] sm:text-[14.5px] leading-[1.38] tracking-[-0.012em] text-ink break-words whitespace-pre-wrap select-text">
            {renderMessageBody(message.body)}
          </div>

          {/* Message Delivery Status for Sending / Failed */}
          {message.status !== "sent" && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-mist font-sans tracking-tight">
              {message.status === "sending" && <span className="italic text-mist">Sending…</span>}
              {message.status === "failed" && (
                <>
                  <span className="text-flag font-medium">Failed to send.</span>
                  <button
                    type="button"
                    onClick={() => onRetry(message.clientKey)}
                    className="font-medium text-harbor-dark underline underline-offset-2"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          )}

          {/* Slack-Style Interactive Reaction Pills */}
          {reactionEntries.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 items-center font-sans tracking-tight">
              {reactionEntries.map(([emoji, count]) => {
                const hasReacted = myReactions.includes(emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggleReaction?.(message.id, emoji)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs transition-all active:scale-95 font-sans tracking-tight ${
                      hasReacted
                        ? "border border-harbor bg-harbor-tint text-harbor-dark font-semibold shadow-2xs"
                        : "border border-line bg-card hover:bg-horizon-50 text-ink-soft hover:border-mist"
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="text-[11px] font-mono">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Slack-Style Floating Hover (Desktop) & Press-and-Hold (Mobile) Action Pill */}
          {message.status === "sent" && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute -top-3.5 right-1 sm:right-auto sm:left-[min(100%,480px)] sm:-translate-x-full items-center gap-0.5 rounded-full border border-line bg-card shadow-md px-1.5 py-0.5 z-30 transition-all font-sans tracking-tight ${
                showMobileActions
                  ? "flex ring-2 ring-harbor/30 scale-105 shadow-lg"
                  : "hidden group-hover:flex"
              }`}
            >
              {QUICK_ACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onToggleReaction?.(message.id, emoji);
                    setShowMobileActions(false);
                  }}
                  title={`React with ${emoji}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-horizon-50 text-xs transition-colors active:scale-90"
                >
                  {emoji}
                </button>
              ))}

              <div className="h-3.5 w-px bg-line mx-0.5" />

              {/* Copy Message Button */}
              <button
                type="button"
                onClick={() => {
                  handleCopy();
                  setShowMobileActions(false);
                }}
                title={copied ? "Copied!" : "Copy message text"}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-horizon-50 text-mist hover:text-ink text-xs transition-colors"
              >
                {copied ? (
                  <span className="text-[10px] text-harbor-dark font-semibold">✓</span>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                )}
              </button>

              {/* Report Button (other senders only) */}
              {canReport && <ReportButton messageId={message.id} />}
            </div>
          )}
        </div>
      </div>
    </>
  );
});
