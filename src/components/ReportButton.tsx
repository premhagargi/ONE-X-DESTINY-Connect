"use client";

import { useId, useState } from "react";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "scam_or_phishing", label: "Scam or phishing link" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];

export function ReportButton({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogId = useId();

  async function submit(reason: string) {
    setError(null);
    try {
      const res = await fetch(`/api/messages/${messageId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        setError("Couldn't send the report. Try again.");
        return;
      }
      setSubmitted(true);
      setTimeout(() => setOpen(false), 1200);
    } catch {
      setError("Connection problem.");
    }
  }

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={dialogId}
        aria-label="Report this message"
        className="rounded-full p-1.5 text-mist opacity-0 transition-opacity hover:bg-horizon hover:text-ink focus-visible:opacity-100 group-hover/msg:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.8" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label="Report message"
          className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-line bg-card p-2 shadow-lg"
        >
          {submitted ? (
            <p className="px-2 py-2 text-sm text-ink-soft">Thanks — a moderator will take a look.</p>
          ) : (
            <>
              <p className="px-2 pb-1 pt-1 text-xs font-medium text-mist">Report message</p>
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => submit(r.value)}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-horizon"
                >
                  {r.label}
                </button>
              ))}
              {error && <p className="px-2 pt-1 text-xs text-flag">{error}</p>}
            </>
          )}
        </div>
      )}
    </span>
  );
}
