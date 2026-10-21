import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRoomBySlug } from "@/server/rooms";
import { getCurrentSession, touchSession } from "@/server/session";
import {
  createMessage,
  getHistoryPage,
  getMessagesSince,
  isRepeatedMessage,
} from "@/server/messages";
import { broadcastMessage } from "@/server/broadcast";
import { isMessageRateLimited } from "@/server/rate-limit";
import { clientKeySchema, messageBodySchema } from "@/lib/validation";
import { DUPLICATE_MESSAGE_LOOKBACK } from "@/lib/constants";

/**
 * GET /api/rooms/:slug/messages?before=<id>   -> older page
 * GET /api/rooms/:slug/messages?since=<id>    -> messages after a cursor
 *                                                 (used to reconcile after
 *                                                 a realtime reconnect)
 * GET /api/rooms/:slug/messages               -> most recent page
 *
 * The room is resolved from the trusted URL slug on every call, and every
 * underlying query is scoped by that room's id — so a client cannot read
 * another room's history by supplying a different `before`/`since` id:
 * those cursors are only ever looked up *within* this room (see
 * getHistoryPage/getMessagesSince), and a cursor from a foreign room
 * simply matches nothing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const before = url.searchParams.get("before");

  if (since) {
    const messages = await getMessagesSince(room.id, since);
    return NextResponse.json({ messages });
  }

  const page = await getHistoryPage(room.id, before);
  return NextResponse.json(page);
}

const sendSchema = z.object({
  body: z.string(),
  clientKey: z.string(),
});

/**
 * POST /api/rooms/:slug/messages
 *
 * Server-side half of "instant chat": by the time this handler runs, the
 * sender's browser has already rendered the message optimistically (see
 * ChatRoom.tsx). This endpoint validates, persists, and then publishes a
 * Realtime Broadcast event so *other* participants receive it — the
 * sender reconciles their own optimistic bubble against the HTTP response
 * here, not against the broadcast (see useRealtimeMessages).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room || !room.isActive) {
    return NextResponse.json({ error: "room_inactive" }, { status: 404 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }
  if (session.isSuspended) {
    return NextResponse.json({ error: "suspended" }, { status: 403 });
  }
  if (session.roomId !== room.id) {
    return NextResponse.json({ error: "not_in_room" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsedBody = messageBodySchema.safeParse(parsed.data.body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "invalid_message", message: parsedBody.error.issues[0]?.message },
      { status: 400 },
    );
  }
  const parsedKey = clientKeySchema.safeParse(parsed.data.clientKey);
  if (!parsedKey.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (await isMessageRateLimited(session.id)) {
    return NextResponse.json(
      { error: "rate_limited", message: "You're sending messages too quickly." },
      { status: 429 },
    );
  }

  if (
    await isRepeatedMessage(
      room.id,
      session.id,
      parsedBody.data,
      DUPLICATE_MESSAGE_LOOKBACK,
    )
  ) {
    return NextResponse.json(
      {
        error: "duplicate_message",
        message: "You already sent that message.",
      },
      { status: 429 },
    );
  }

  const result = await createMessage({
    roomId: room.id,
    sessionId: session.id,
    nickname: session.nickname,
    body: parsedBody.data,
    clientKey: parsedKey.data,
  });

  await touchSession(session);

  // Only broadcast on a genuinely new row — a deduped retry means the
  // original send already triggered a broadcast.
  if (!result.deduped) {
    await broadcastMessage(room.slug, result.message);
  }

  return NextResponse.json({ message: result.message }, { status: 201 });
}
