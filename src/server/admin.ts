import "server-only";
import { NextRequest } from "next/server";

/**
 * Minimal admin auth: a single shared secret, sent as the `x-admin-secret`
 * header, checked with a constant-time comparison. This is intentionally
 * the "simple protected mechanism" the spec calls for rather than a full
 * admin dashboard/auth system — see README "Moderation" for how to use it
 * and its limitations.
 */
export function isAuthorizedAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;

  const provided = req.headers.get("x-admin-secret");
  if (!provided) return false;

  return timingSafeEqual(provided, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
