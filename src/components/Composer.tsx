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
const QUICK_EMOJIS = ["✈️", "🗺️", "📍", "🎒", "🏨", "👍", "❤️"];

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
  const prevHeightRef = useRef<number>(0);
  const resizeRafRef = useRef<number | null>(null);

  // Non-blocking auto-resize fallback for browsers lacking native field-sizing
  const scheduleResize = useCallback(() => {
    if (resizeRafRef.current !== null) return;
    resizeRafRef.current = requestAnimationFrame(() => {
      resizeRafRef.current = null;
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      const targetHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX);
      if (targetHeight !== prevHeightRef.current) {
        prevHeightRef.current = targetHeight;
        el.style.height = `${targetHeight}px`;
      }
    });
  }, []);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    scheduleResize();
  }

  async function doSend() {
    const body = draft.trim();
    if (!body || sending || disabled) return;

    setDraft("");
    setError(null);
    prevHeightRef.current = 0;
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setSending(true);

    const result = await onSend(body);
    setSending(false);

    if (!result.ok) {
      setDraft(body);
      setError(result.error ?? "Couldn't send. Try again.");
      scheduleResize();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void doSend();
    }
  }

  function insertEmoji(emoji: string) {
    if (disabled) return;
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
      scheduleResize();
    });
  }

  const remaining = MESSAGE_MAX_LENGTH - draft.length;
  const nearLimit = remaining <= 80;

  return (
    <div className="border-t border-line bg-card px-3 py-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      {error && <p className="mb-2 px-1 text-sm text-flag">{error}</p>}
      {disabled && disabledReason && (
        <p className="mb-2 px-1 text-sm text-mist">{disabledReason}</p>
      )}

      {/* Slack-style contained input card */}
      <div className="flex flex-col rounded-2xl border border-line bg-horizon-50/40 shadow-xs transition-all focus-within:border-harbor focus-within:bg-card focus-within:ring-2 focus-within:ring-harbor/15">
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="Message the room… (Shift+Enter for new line)"
          aria-label="Message"
          disabled={disabled}
          className="auto-field-sizing max-h-[160px] min-h-[44px] w-full resize-none border-0 bg-transparent px-4 pt-3 pb-2 text-[15px] leading-relaxed text-ink outline-none placeholder:text-mist/70 disabled:cursor-not-allowed disabled:opacity-60"
        />

        {/* Embedded Slack-style bottom toolbar */}
        <div className="flex items-center justify-between border-t border-line/40 px-3 py-2">
          {/* Quick reactions */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={disabled}
                onClick={() => insertEmoji(emoji)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-harbor-tint/80 text-sm transition-colors active:scale-95 disabled:opacity-40"
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Counter and Send button */}
          <div className="flex items-center gap-2">
            {nearLimit && !disabled && (
              <span className="shrink-0 text-right text-xs font-medium text-mist">
                {remaining}
              </span>
            )}

            <button
              type="button"
              onClick={() => void doSend()}
              disabled={disabled || sending || draft.trim().length === 0}
              aria-label="Send message"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-compass px-3 text-xs font-medium text-white transition-all hover:bg-compass-dark active:scale-95 disabled:cursor-not-allowed disabled:bg-line disabled:text-mist"
            >
              <span>Send</span>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M17.5 2.5 2.5 8.75l6.1 2.65 2.65 6.1L17.5 2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path d="M17.5 2.5 8.6 11.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
