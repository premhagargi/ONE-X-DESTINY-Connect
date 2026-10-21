import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/server/session";
import { createReport } from "@/server/moderation";
import { isReportRateLimited } from "@/server/rate-limit";
import { reportReasonSchema } from "@/lib/validation";

const bodySchema = z.object({ reason: reportReasonSchema });

/** POST /api/messages/:id/report — any session may report any message. No
 * auth beyond "has a session" is required; reports are reviewed via the
 * admin endpoints. Rate-limited per session to deter report-flooding. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  if (await isReportRateLimited(session.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const message = await prisma.message.findUnique({ where: { id }, select: { id: true } });
  if (!message) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await createReport({ messageId: id, sessionId: session.id, reason: parsed.data.reason });
  return NextResponse.json({ ok: true }, { status: 201 });
}
