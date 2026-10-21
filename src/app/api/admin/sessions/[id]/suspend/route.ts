import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedAdmin } from "@/server/admin";
import { adminSuspendSession } from "@/server/moderation";

const bodySchema = z.object({
  reason: z.string().min(1).max(200).default("Suspended by moderator"),
});

/** POST /api/admin/sessions/:id/suspend — blocks a session from sending
 * further messages or rejoining a room. Requires `x-admin-secret`. */
export async function POST(
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

  await adminSuspendSession(id, parsed.data.reason);
  return NextResponse.json({ ok: true });
}
