import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdmin } from "@/server/admin";
import { listOpenReports } from "@/server/moderation";

/** GET /api/admin/reports — list open reports. Requires `x-admin-secret`
 * header matching ADMIN_SECRET. See README "Moderation" for usage. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const reports = await listOpenReports();
  return NextResponse.json({ reports });
}
