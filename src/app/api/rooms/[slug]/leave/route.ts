import { NextResponse } from "next/server";
import { getCurrentSession, leaveRoom } from "@/server/session";

/** POST /api/rooms/:slug/leave — clears the session's current room so the
 * person can pick a different one. The session itself (and its nickname)
 * is preserved so rejoining the same room later keeps continuity. */
export async function POST() {
  const session = await getCurrentSession();
  if (session) {
    await leaveRoom(session);
  }
  return NextResponse.json({ ok: true });
}
