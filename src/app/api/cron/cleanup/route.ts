import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_RETENTION_DAYS } from "@/lib/constants";

/**
 * GET /api/cron/cleanup
 *
 * Deletes messages older than the retention window (RETENTION_DAYS env
 * var, default 30 days — see .env.example) and expired, unsuspended
 * sessions. Protected by a bearer-token check against CRON_SECRET so it
 * can't be triggered by an arbitrary caller.
 *
 * Trigger strategy (documented fallback for free tiers — see README
 * "Retention" section):
 * - Preferred: Vercel Cron (vercel.json), which on the Hobby plan allows
 *   at most one run per day — fine for a 30-day retention window.
 * - Fallback if Cron isn't available/enabled: call this endpoint manually
 *   or from any external scheduler (e.g. a free GitHub Actions cron, or
 *   even a browser bookmark) with the CRON_SECRET bearer token. The
 *   endpoint is idempotent and safe to call more often than needed.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "not_configured", message: "CRON_SECRET is not set." },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const retentionDays = Number(process.env.RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deletedMessages = await prisma.message.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  const deletedSessions = await prisma.chatSession.deleteMany({
    where: { expiresAt: { lt: new Date() }, isSuspended: false },
  });

  return NextResponse.json({
    ok: true,
    retentionDays,
    deletedMessages: deletedMessages.count,
    deletedSessions: deletedSessions.count,
  });
}
