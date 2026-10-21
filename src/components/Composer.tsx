"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { MESSAGE_MAX_LENGTH } from "@/lib/constants";

const MAX_TEXTAREA_HEIGHT_PX = 160;

export function Composer({
  onSend,
  disabled,
  disabledReason,
}: {
  onSend: (body: string) => Promise<{ ok: boolean; error?: string }>;
  disabled: boolean;
  disabledReason?: string;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, []);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    resize();
  }

  async function doSend() {
    const body = draft.trim();
    if (!body || sending || disabled) return;

    // Clear + reset the box immediately so the person isn't waiting on a
    // network round trip to keep typing their next message — the message
    // itself is rendered optimistically by the parent via onSend.
    setDraft("");
    setError(null);
    requestAnimationFrame(resize);
    setSending(true);

    const result = await onSend(body);
    setSending(false);

    if (!result.ok) {
      // Don't silently discard: restore the draft so nothing is lost, and
      // surface why.
      setDraft(body);
      setError(result.error ?? "Couldn't send. Try again.");
      requestAnimationFrame(resize);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void doSend();
    }
  }

  const remaining = MESSAGE_MAX_LENGTH - draft.length;
  const nearLimit = remaining <= 80;

  return (
    <div className="border-t border-line bg-card px-3 py-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
      {error && <p className="mb-2 px-1 text-sm text-flag">{error}</p>}
      {disabled && disabledReason && (
        <p className="mb-2 px-1 text-sm text-mist">{disabledReason}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="Write a message…"
          aria-label="Message"
          disabled={disabled}
          className="min-h-11 flex-1 resize-none rounded-2xl border border-line bg-horizon-50 px-4 py-2.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-mist/70 focus-visible:border-harbor disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void doSend()}
          disabled={disabled || sending || draft.trim().length === 0}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-compass text-white transition-colors hover:bg-compass-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-mist"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M17.5 2.5 2.5 8.75l6.1 2.65 2.65 6.1L17.5 2.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M17.5 2.5 8.6 11.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {nearLimit && !disabled && (
        <p className="mt-1 px-1 text-right text-xs text-mist">{remaining} left</p>
      )}
    </div>
  );
}
