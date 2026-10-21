"use client";

import { useState } from "react";
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

function renderMessageBody(text: string, isMine: boolean) {
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
          className={`underline underline-offset-2 break-all ${
            isMine ? "text-white/95 hover:text-white" : "text-harbor-dark hover:underline font-medium"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function MessageBubble({
  message,
  isMine,
  showNickname,
  onRetry,
}: {
  message: ChatMessage;
  isMine: boolean;
  showNickname: boolean;
  onRetry: (clientKey: string) => void;
}) {
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

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {showNickname && !isMine && (
        <div className="mb-1 ml-1 flex items-center gap-1.5">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarStyle.bg} ${avatarStyle.text}`}
          >
            {initial}
          </span>
          <span className="text-xs font-medium text-harbor-dark">
            {message.nickname}
          </span>
        </div>
      )}

      <div className="group/msg flex max-w-[85%] items-end gap-1.5 sm:max-w-[72%]">
        {/* Copy button for sender */}
        {isMine && message.status === "sent" && (
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy message"}
            className="opacity-0 transition-opacity group-hover/msg:opacity-100 text-mist hover:text-ink text-xs p-1"
          >
            {copied ? (
              <span className="text-[10px] text-harbor-dark font-medium">Copied!</span>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
        )}

        <div
          className={`px-3.5 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap transition-shadow ${
            isMine
              ? "bubble-mine bg-harbor text-white"
              : "bubble-theirs border border-line bg-card text-ink"
          } ${message.status === "failed" ? "opacity-60" : ""}`}
        >
          {renderMessageBody(message.body, isMine)}
        </div>

        {/* Copy button & Report button for other participants */}
        {!isMine && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleCopy}
              title={copied ? "Copied!" : "Copy message"}
              className="opacity-0 transition-opacity group-hover/msg:opacity-100 text-mist hover:text-ink text-xs p-1"
            >
              {copied ? (
                <span className="text-[10px] text-harbor-dark font-medium">Copied!</span>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              )}
            </button>
            {canReport && <ReportButton messageId={message.id} />}
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5 px-1 text-xs text-mist">
        {message.status === "sending" && <span>Sending…</span>}
        {message.status === "failed" && (
          <>
            <span className="text-flag">Not sent.</span>
            <button
              type="button"
              onClick={() => onRetry(message.clientKey)}
              className="font-medium text-harbor-dark underline underline-offset-2"
            >
              Retry
            </button>
          </>
        )}
        {message.status === "sent" && <span>{formatTime(message.createdAt)}</span>}
      </div>
    </div>
  );
}
