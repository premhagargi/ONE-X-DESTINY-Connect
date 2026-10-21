import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HISTORY_LOAD_MORE_SIZE, HISTORY_PAGE_SIZE } from "@/lib/constants";
import type { HistoryPage, PublicMessage } from "@/types/chat";

function toPublic(m: {
  id: string;
  roomId: string;
  nickname: string;
  body: string;
  clientKey: string;
  createdAt: Date;
}): PublicMessage {
  return {
    id: m.id,
    roomId: m.roomId,
    nickname: m.nickname,
    body: m.body,
    clientKey: m.clientKey,
    createdAt: m.createdAt.toISOString(),
  };
}

/**
 * Loads a page of message history for a room.
 *
 * - With no `before` cursor: the most recent HISTORY_PAGE_SIZE messages,
 *   returned oldest-first (ready to render top-to-bottom).
 * - With a `before` cursor (a message id): the next
 *   HISTORY_LOAD_MORE_SIZE messages older than that message, also
 *   oldest-first.
 *
 * Both queries are served by the @@index([roomId, createdAt]) index on
 * Message. Isolation by room is enforced here (every query is scoped by
 * roomId) and again at the route layer (the room is resolved from the
 * trusted URL slug, not from client-supplied input) — a client cannot
 * read another room's history by any parameter it controls.
 */
export async function getHistoryPage(
  roomId: string,
  before?: string | null,
): Promise<HistoryPage> {
  const take = before ? HISTORY_LOAD_MORE_SIZE : HISTORY_PAGE_SIZE;

  let cursorCreatedAt: Date | undefined;
  if (before) {
    const cursorMsg = await prisma.message.findFirst({
      where: { id: before, roomId },
      select: { createdAt: true },
    });
    // An invalid/foreign cursor just yields no older results, rather than
    // erroring — simplest safe behavior for a cursor the client echoes back.
    if (!cursorMsg) return { messages: [], nextCursor: null };
    cursorCreatedAt = cursorMsg.createdAt;
  }

  const rows = await prisma.message.findMany({
    where: {
      roomId,
      isDeleted: false,
      ...(cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
  });

  const hasMore = rows.length > take;
  const page = rows.slice(0, take).reverse();

  return {
    messages: page.map(toPublic),
    nextCursor: hasMore ? page[0]?.id ?? null : null,
  };
}

/** Messages created after a given message id — used by the client to
 * reconcile after a reconnect (recovering anything missed while the
 * Realtime socket was down). Capped generously; a client reconnecting
 * after a very long gap should fall back to a fresh getHistoryPage instead. */
export async function getMessagesSince(
  roomId: string,
  afterMessageId: string,
): Promise<PublicMessage[]> {
  const cursorMsg = await prisma.message.findFirst({
    where: { id: afterMessageId, roomId },
    select: { createdAt: true },
  });
  if (!cursorMsg) return [];

  const rows = await prisma.message.findMany({
    where: {
      roomId,
      isDeleted: false,
      createdAt: { gt: cursorMsg.createdAt },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return rows.map(toPublic);
}

export type CreateMessageResult =
  | { ok: true; message: PublicMessage; deduped: false }
  | { ok: true; message: PublicMessage; deduped: true };

/**
 * Persists a message. Idempotent on (roomId, clientKey): if the client
 * retries a send (e.g. after a flaky network response that actually
 * succeeded), the unique constraint on Message causes the second insert
 * to fail, and we transparently return the original row instead of
 * creating a duplicate or erroring the retry.
 */
export async function createMessage(params: {
  roomId: string;
  sessionId: string;
  nickname: string;
  body: string;
  clientKey: string;
}): Promise<CreateMessageResult> {
  const { roomId, sessionId, nickname, body, clientKey } = params;

  try {
    const row = await prisma.message.create({
      data: { roomId, sessionId, nickname, body, clientKey },
    });
    return { ok: true, message: toPublic(row), deduped: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.message.findUnique({
        where: { roomId_clientKey: { roomId, clientKey } },
      });
      if (existing) {
        return { ok: true, message: toPublic(existing), deduped: true };
      }
    }
    throw err;
  }
}

/** Simple, documented anti-spam check: rejects a message that is identical
 * to one of the sender's own last few messages in this room. */
export async function isRepeatedMessage(
  roomId: string,
  sessionId: string,
  body: string,
  lookback: number,
): Promise<boolean> {
  const recent = await prisma.message.findMany({
    where: { roomId, sessionId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: lookback,
    select: { body: true },
  });
  return recent.length > 0 && recent.every((m) => m.body === body);
}
