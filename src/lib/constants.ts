/**
 * Central, documented configuration. Keeping every tunable number here (as
 * opposed to scattered magic numbers) is what lets the "configurable 30-day
 * retention" and similar requirements stay genuinely configurable.
 */

export const SESSION_COOKIE_NAME = "atc_session";

/** How long an anonymous session stays valid without activity. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** A session's lastSeenAt is refreshed at most this often, to avoid a DB
 * write on every single request. */
export const SESSION_TOUCH_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 24;
/** Letters (any script), numbers, spaces, and a small set of punctuation.
 * Deliberately excludes characters commonly used for impersonation tricks
 * (zero-width characters are stripped before this check runs). */
export const NICKNAME_PATTERN = /^[\p{L}\p{N} _.'-]+$/u;

export const MESSAGE_MAX_LENGTH = 1000;

/** Messages older than this are eligible for cleanup. Override with the
 * RETENTION_DAYS env var. */
export const DEFAULT_RETENTION_DAYS = 30;

export const HISTORY_PAGE_SIZE = 50;
export const HISTORY_LOAD_MORE_SIZE = 30;

/** Rate limits are enforced in the database (see src/server/rate-limit.ts)
 * rather than in-memory, because serverless functions on Vercel are
 * stateless and may run as many concurrent, short-lived instances — an
 * in-process counter would under-count and let bursts through. */
export const RATE_LIMIT_MESSAGES = {
  /** Max messages a single session may send in the trailing window. */
  max: 8,
  windowMs: 10_000,
};

export const RATE_LIMIT_JOIN = {
  max: 10,
  windowMs: 60_000,
};

export const RATE_LIMIT_REPORT = {
  max: 5,
  windowMs: 60_000,
};

/** Identical, consecutive messages from the same session within this many
 * sends are rejected as likely spam/accidental double-send. */
export const DUPLICATE_MESSAGE_LOOKBACK = 3;
