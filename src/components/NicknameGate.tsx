"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from "@/lib/constants";

const TRAVEL_NICKNAMES = [
  "Wandering Owl",
  "Himalayan Nomad",
  "Solo Backpacker",
  "Midnight Voyager",
  "Alpine Trekker",
  "Coastal Rover",
  "Silent Drifter",
  "Curious Wayfarer",
  "Island Explorer",
  "Desert Pilgrim",
  "Mountain Stray",
  "Urban Stroller",
];

/**
 * The nickname-entry screen shown before joining a room.
 * Remembers previous nicknames across rooms and sessions on the same browser
 * via localStorage and server session continuity.
 */
export function NicknameGate({
  roomSlug,
  roomName,
  defaultNickname,
  suspended,
}: {
  roomSlug: string;
  roomName: string;
  defaultNickname?: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [nickname, setNickname] = useState(defaultNickname || "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [remembered, setRemembered] = useState(false);

  // Restore nickname from browser localStorage if not passed from server session
  useEffect(() => {
    if (defaultNickname) {
      setNickname(defaultNickname);
      setRemembered(true);
      return;
    }
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("destiny_saved_nickname");
      if (saved) {
        setNickname(saved);
        setRemembered(true);
      }
    }
  }, [defaultNickname]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);

    try {
      const res = await fetch(`/api/rooms/${roomSlug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Couldn't join that room. Try again.");
        setPending(false);
        return;
      }

      // Persist chosen nickname in browser storage for session continuity across rooms
      if (typeof window !== "undefined") {
        localStorage.setItem("destiny_saved_nickname", nickname);
        localStorage.setItem("destiny_active_room", roomSlug);
      }

      // Re-run the server component for this route now that the session
      // cookie reflects membership in the room.
      router.refresh();
    } catch {
      setError("Connection problem. Check your network and try again.");
      setPending(false);
    }
  }

  function pickRandomNickname() {
    const random = TRAVEL_NICKNAMES[Math.floor(Math.random() * TRAVEL_NICKNAMES.length)];
    setNickname(random);
    setRemembered(false);
    setError(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12 font-sans">
      <Link
        href="/"
        className="mb-8 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-mist transition-colors hover:text-harbor-dark"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M12 7H2M6 3 2 7l4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        All rooms
      </Link>

      <p className="text-sm font-medium text-harbor-dark">Joining</p>
      <h1 className="mt-1 font-display text-3xl text-ink">{roomName}</h1>

      {suspended ? (
        <p className="mt-6 rounded-xl border border-flag/30 bg-flag-tint px-4 py-3 text-sm text-flag">
          This session has been suspended and can&apos;t join rooms. If you
          think that&apos;s a mistake, come back with a new session (open this
          page in a private window).
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="text-sm font-medium text-ink-soft">
              {remembered ? "Your nickname in this browser" : "Pick a nickname"}
            </label>
            <button
              type="button"
              onClick={pickRandomNickname}
              className="text-xs font-medium text-harbor transition-colors hover:text-harbor-dark hover:underline"
            >
              🎲 Surprise me
            </button>
          </div>
          <input
            id={inputId}
            name="nickname"
            autoFocus
            autoComplete="off"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setRemembered(false);
            }}
            minLength={NICKNAME_MIN_LENGTH}
            maxLength={NICKNAME_MAX_LENGTH}
            placeholder="e.g. Wandering Owl"
            className="rounded-xl border border-line bg-card px-4 py-3 text-base text-ink outline-none placeholder:text-mist/70 focus-visible:border-harbor shadow-2xs"
            aria-describedby={error ? `${inputId}-error` : undefined}
            aria-invalid={!!error}
          />
          {error ? (
            <p id={`${inputId}-error`} role="alert" className="text-sm text-flag">
              {error}
            </p>
          ) : (
            <p className="text-xs text-mist">
              {remembered
                ? "Recognized from your active browser session. Change it anytime or keep it to continue."
                : "No real names, no account — just how others will see you here."}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || nickname.trim().length < NICKNAME_MIN_LENGTH}
            className="mt-3 rounded-full bg-harbor px-5 py-3 text-base font-medium text-white transition-colors hover:bg-harbor-dark disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
          >
            {pending ? "Joining…" : remembered ? `Join as ${nickname}` : "Join the conversation"}
          </button>
        </form>
      )}
    </div>
  );
}
