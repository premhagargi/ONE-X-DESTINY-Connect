import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedAdmin } from "@/server/admin";
import { adminDeleteMessage, adminResolveReport } from "@/server/moderation";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  reason: z.string().min(1).max(200).default("Removed by moderator"),
  /** Optionally resolve the report that prompted this action in the same call. */
  reportId: z.string().optional(),
});

/** DELETE /api/admin/messages/:id — soft-deletes a message (it stops
 * appearing in history; the row is retained for accountability, matching
 * the Report model's reference). Requires `x-admin-secret`. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await adminDeleteMessage(id, parsed.data.reason);
  if (parsed.data.reportId) {
    await adminResolveReport(parsed.data.reportId, "ACTIONED").catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
