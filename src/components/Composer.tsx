"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { MESSAGE_MAX_LENGTH } from "@/lib/constants";

const MAX_TEXTAREA_HEIGHT_PX = 160;
const QUICK_EMOJIS = ["✈️", "🗺️", "📍", "🎒", "🏨", "👍", "❤️"];

export function Composer({
  roomSlug,
  onSend,
  disabled,
  disabledReason,
}: {
  roomSlug?: string;
  onSend: (body: string) => Promise<{ ok: boolean; error?: string }>;
  disabled: boolean;
  disabledReason?: string;
}) {
  const storageKey = roomSlug ? `destiny_draft_${roomSlug}` : null;

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

  // Restore persisted draft from sessionStorage on mount
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(storageKey);
    if (saved) {
      setDraft(saved);
      scheduleResize();
    }
  }, [storageKey, scheduleResize]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setDraft(val);
    if (storageKey && typeof window !== "undefined") {
      if (val) {
        window.sessionStorage.setItem(storageKey, val);
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
    }
    scheduleResize();
  }

  async function doSend() {
    const body = draft.trim();
    if (!body || sending || disabled) return;

    // Instantly clear draft and storage
    setDraft("");
    if (storageKey && typeof window !== "undefined") {
      window.sessionStorage.removeItem(storageKey);
    }
    setError(null);
    prevHeightRef.current = 0;
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setSending(true);

    const result = await onSend(body);
    setSending(false);

    if (!result.ok) {
      // If error was a content/validation error (e.g. rate limit, duplicate), restore into draft
      // so user can modify it. If connection drop, optimistic bubble in chat provides 1-click retry.
      const isConnectionIssue =
        result.error &&
        (result.error.toLowerCase().includes("connection") ||
          result.error.toLowerCase().includes("network"));

      if (!isConnectionIssue) {
        setDraft(body);
        if (storageKey && typeof window !== "undefined") {
          window.sessionStorage.setItem(storageKey, body);
        }
      }
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
      const next = draft + emoji;
      setDraft(next);
      if (storageKey && typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey, next);
      }
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    if (storageKey && typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, next);
    }
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
    <div className="border-t border-line bg-card px-3 py-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 font-sans tracking-tight">
      <div className="mx-auto w-full max-w-4xl">
        {error && <p className="mb-2 px-1 text-xs text-flag font-medium tracking-tight">{error}</p>}
        {disabled && disabledReason && (
          <p className="mb-2 px-1 text-xs text-mist font-medium tracking-tight">{disabledReason}</p>
        )}

        {/* Slack-style contained input card */}
        <div className="flex flex-col rounded-2xl border border-line bg-horizon-50/40 shadow-xs transition-all focus-within:border-harbor focus-within:bg-card focus-within:ring-2 focus-within:ring-harbor/15 font-sans tracking-tight">
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
            className="no-focus-outline auto-field-sizing max-h-[160px] min-h-[44px] w-full resize-none border-0 bg-transparent px-4 pt-3 pb-2 font-sans text-[14px] sm:text-[14.5px] leading-snug tracking-[-0.012em] text-ink outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 placeholder:text-mist/70 disabled:cursor-not-allowed disabled:opacity-60"
          />

          {/* Embedded Slack-style bottom toolbar */}
          <div className="flex items-center justify-between border-t border-line/40 px-3 py-2 font-sans tracking-tight">
            {/* Quick reactions with mobile-friendly touch targets */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={disabled}
                  onClick={() => insertEmoji(emoji)}
                  className="flex h-8 w-8 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg hover:bg-harbor-tint/80 text-base sm:text-sm transition-colors active:scale-95 disabled:opacity-40"
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Counter and Send button */}
            <div className="flex items-center gap-2">
              {nearLimit && !disabled && (
                <span className="shrink-0 text-right text-xs font-medium text-mist font-mono tracking-tight">
                  {remaining}
                </span>
              )}

              <button
                type="button"
                onClick={() => void doSend()}
                disabled={disabled || sending || draft.trim().length === 0}
                aria-label="Send message"
                className="flex h-8 items-center gap-1.5 rounded-lg bg-compass px-3.5 text-xs font-semibold text-white tracking-tight transition-all hover:bg-compass-dark active:scale-95 disabled:cursor-not-allowed disabled:bg-line disabled:text-mist shadow-xs"
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
    </div>
  );
}
