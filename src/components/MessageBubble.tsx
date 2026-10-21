"use client";

import { memo, useState } from "react";
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

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
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

  const reactionEntries = Object.entries(reactions).filter(([, count]) => count > 0);

  return (
    <div
      className={`slack-msg-row group relative flex gap-3 px-3 sm:px-4 py-1.5 transition-colors hover:bg-horizon/50 rounded-xl ${
        isConsecutive ? "mt-0.5" : "mt-2.5"
      } ${message.status === "failed" ? "opacity-60" : ""}`}
    >
      {/* Left Avatar Gutter */}
      <div className="w-9 shrink-0 flex justify-center">
        {!isConsecutive ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-2xs ${avatarStyle.bg} ${avatarStyle.text}`}
          >
            {initial}
          </span>
        ) : (
          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-mist transition-opacity self-start pt-1 font-mono">
            {formatTime(message.createdAt).split(" ")[0]}
          </span>
        )}
      </div>

      {/* Message Content */}
      <div className="min-w-0 flex-1">
        {!isConsecutive && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-semibold text-sm text-ink">{message.nickname}</span>
            {isMine && (
              <span className="rounded bg-harbor-tint px-1.5 py-0.2 text-[10px] font-medium text-harbor-dark">
                You
              </span>
            )}
            <span className="text-xs text-mist">{formatTime(message.createdAt)}</span>
          </div>
        )}

        {/* Message Body */}
        <div className="text-[15px] leading-relaxed text-ink break-words whitespace-pre-wrap select-text">
          {renderMessageBody(message.body)}
        </div>

        {/* Message Delivery Status for Sending / Failed */}
        {message.status !== "sent" && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-mist">
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
          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
            {reactionEntries.map(([emoji, count]) => {
              const hasReacted = myReactions.includes(emoji);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onToggleReaction?.(message.id, emoji)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs transition-all active:scale-95 ${
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
      </div>

      {/* Slack-Style Floating Hover Action Pill */}
      {message.status === "sent" && (
        <div className="absolute right-3 -top-3.5 hidden group-hover:flex items-center gap-0.5 rounded-full border border-line bg-card shadow-md px-1.5 py-0.5 z-10 transition-all">
          {QUICK_ACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction?.(message.id, emoji)}
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
            onClick={handleCopy}
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
  );
});
