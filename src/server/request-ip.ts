import "server-only";
import { NextRequest } from "next/server";

/** Best-effort client IP, used only for join-rate-limiting — never stored.
 * On Vercel, `x-forwarded-for` is set by the platform edge; we do not trust
 * it for anything security-critical beyond coarse throttling. */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
