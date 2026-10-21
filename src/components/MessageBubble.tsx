"use client";

import type { ChatMessage } from "@/types/chat";
import { ReportButton } from "./ReportButton";

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
  const canReport = message.status === "sent";

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {showNickname && !isMine && (
        <span className="mb-1 ml-1 text-xs font-medium text-harbor-dark">
          {message.nickname}
        </span>
      )}

      <div className="group/msg flex max-w-[82%] items-end gap-1.5 sm:max-w-[70%]">
        {isMine && canReport && <ReportButton messageId={message.id} />}

        <div
          className={`px-3.5 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
            isMine
              ? "bubble-mine bg-harbor text-white"
              : "bubble-theirs border border-line bg-card text-ink"
          } ${message.status === "failed" ? "opacity-60" : ""}`}
        >
          {message.body}
        </div>

        {!isMine && canReport && <ReportButton messageId={message.id} />}
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
