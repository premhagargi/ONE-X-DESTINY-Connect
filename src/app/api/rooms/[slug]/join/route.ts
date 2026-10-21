import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRoomBySlug } from "@/server/rooms";
import {
  createOrRejoinSession,
  getCurrentSession,
  setSessionCookie,
} from "@/server/session";
import { isJoinRateLimited } from "@/server/rate-limit";
import { getClientIp } from "@/server/request-ip";
import { nicknameKeyOf, nicknameSchema } from "@/lib/validation";

const bodySchema = z.object({ nickname: z.string() });

/**
 * POST /api/rooms/:slug/join
 *
 * Validates + normalizes the nickname, checks it's not already taken by
 * another active participant in this room, and creates (or updates) the
 * caller's anonymous session — setting the HttpOnly session cookie.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (isJoinRateLimited(getClientIp(req))) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many attempts. Please wait a moment." },
      { status: 429 },
    );
  }

  const room = await getRoomBySlug(slug);
  if (!room || !room.isActive) {
    return NextResponse.json(
      { error: "room_inactive", message: "This room isn't available right now." },
      { status: 404 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsedNickname = nicknameSchema.safeParse(parsedBody.data.nickname);
  if (!parsedNickname.success) {
    return NextResponse.json(
      { error: "invalid_nickname", message: parsedNickname.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const nickname = parsedNickname.data;
  const existing = await getCurrentSession();

  if (existing?.isSuspended) {
    return NextResponse.json(
      { error: "suspended", message: "This session has been suspended." },
      { status: 403 },
    );
  }

  const result = await createOrRejoinSession({
    nickname,
    nicknameKey: nicknameKeyOf(nickname),
    roomId: room.id,
    existing,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "nickname_taken",
        message: "That nickname is already in use in this room. Try another.",
      },
      { status: 409 },
    );
  }

  await setSessionCookie(result.session.token);

  return NextResponse.json({
    nickname: result.session.nickname,
    room: { slug: room.slug, name: room.name },
  });
}
