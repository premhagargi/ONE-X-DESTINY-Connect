import "server-only";
import { prisma } from "@/lib/prisma";
import { RATE_LIMIT_JOIN, RATE_LIMIT_MESSAGES, RATE_LIMIT_REPORT } from "@/lib/constants";

/**
 * Message and report rate limiting are implemented as a database query
 * (count rows in a trailing time window) rather than an in-process
 * counter. On Vercel, each API route invocation may run on a different,
 * short-lived serverless instance — an in-memory Map would be per-instance
 * and under-count a determined abuser spreading requests across cold
 * starts. A count-recent-rows query is correct regardless of instance
 * count and needs no extra paid service (Redis, etc.). It is a "fixed
 * recent window" limiter, not a precise token bucket — adequate for
 * MVP-level abuse prevention.
 */

export async function isMessageRateLimited(sessionId: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_MESSAGES.windowMs);
  const count = await prisma.message.count({
    where: { sessionId, createdAt: { gt: since } },
  });
  return count >= RATE_LIMIT_MESSAGES.max;
}

export async function isReportRateLimited(sessionId: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_REPORT.windowMs);
  const count = await prisma.report.count({
    where: { sessionId, createdAt: { gt: since } },
  });
  return count >= RATE_LIMIT_REPORT.max;
}

/**
 * Join/session-creation rate limiting, keyed by IP address.
 *
 * Unlike messages and reports, a *new* session has no sessionId yet to
 * query the database by — so this one genuinely needs a different
 * mechanism. We use a small in-memory sliding-window counter keyed by the
 * caller's IP, which is a documented, known limitation (see README
 * "What the MVP can and cannot prevent"): it resets on every cold start
 * and is not shared across concurrent serverless instances, so it throttles
 * a single sustained abuser but will not catch a distributed one. Adding a
 * durable, cross-instance version (e.g. Upstash Redis's free tier) is a
 * reasonable follow-up noted in the README rather than built here, to avoid
 * introducing another paid-tier dependency for the MVP.
 */
const joinAttempts = new Map<string, number[]>();

export function isJoinRateLimited(ip: string): boolean {
  const now = Date.now();
  const since = now - RATE_LIMIT_JOIN.windowMs;
  const existing = joinAttempts.get(ip) ?? [];
  const recent = existing.filter((t) => t > since);

  if (recent.length >= RATE_LIMIT_JOIN.max) {
    joinAttempts.set(ip, recent);
    return true;
  }

  recent.push(now);
  joinAttempts.set(ip, recent);

  // Opportunistic cleanup so the map doesn't grow unbounded over a long
  // warm instance lifetime.
  if (joinAttempts.size > 10_000) {
    for (const [key, times] of joinAttempts) {
      if (times.every((t) => t <= since)) joinAttempts.delete(key);
    }
  }

  return false;
}
