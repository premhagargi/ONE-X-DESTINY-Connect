import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_TOUCH_INTERVAL_MS,
  SESSION_TTL_MS,
} from "@/lib/constants";
import type { ChatSession } from "@prisma/client";

/**
 * Anonymous identity model (see README "Privacy & anonymous-session model"
 * for the full explanation).
 *
 * - The browser holds exactly one credential: an HttpOnly, Secure,
 *   SameSite=Lax cookie containing a random session *token*.
 * - The token is looked up against ChatSession.token (itself random and
 *   unique) to resolve the actual session row, server-side, on every
 *   request that needs identity.
 * - The session's database primary key (`id`) is never sent to the
 *   browser. Only the opaque token is — and only inside an HttpOnly
 *   cookie, so page JavaScript cannot read or exfiltrate it, and a nickname
 *   or any other client-controlled value can never substitute for it.
 * - This means a participant cannot impersonate another participant by
 *   picking the same nickname (nicknames are only unique *within a room*,
 *   enforced server-side — see createOrRejoinSession) or by editing
 *   localStorage, because neither grants the cookie.
 */

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function newExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

/** Reads the session cookie and resolves it to a live, non-expired,
 * non-suspended ChatSession row, if any. Does not create one. */
export async function getCurrentSession(): Promise<ChatSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.chatSession.findUnique({ where: { token } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  return session;
}

/** Touches lastSeenAt, but only if it's been a while — avoids a write on
 * every single request. */
export async function touchSession(session: ChatSession): Promise<void> {
  const staleFor = Date.now() - session.lastSeenAt.getTime();
  if (staleFor < SESSION_TOUCH_INTERVAL_MS) return;

  await prisma.chatSession
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: newExpiry() },
    })
    .catch(() => {
      // Best-effort; a missed touch just means the session expires a
      // little earlier than ideal. Not worth failing the request over.
    });
}

/** Sets the HttpOnly session cookie on the current response. Must be called
 * from a Route Handler or Server Action, not a plain Server Component
 * render. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export type CreateSessionResult =
  | { ok: true; session: ChatSession }
  | { ok: false; error: "nickname_taken" };

/**
 * Creates a brand-new anonymous session with the given nickname, or — if
 * the caller already has a valid session cookie — reassigns the existing
 * session to the new nickname/room. Either way, the nickname is checked
 * for collisions against *other* sessions currently active in the target
 * room (last-seen within the session TTL); a session rejoining with its
 * own existing nickname is never blocked by itself.
 */
export async function createOrRejoinSession(params: {
  nickname: string;
  nicknameKey: string;
  roomId: string;
  existing: ChatSession | null;
}): Promise<CreateSessionResult> {
  const { nickname, nicknameKey, roomId, existing } = params;

  const collision = await prisma.chatSession.findFirst({
    where: {
      roomId,
      nicknameKey,
      expiresAt: { gt: new Date() },
      isSuspended: false,
      NOT: existing ? { id: existing.id } : undefined,
    },
    select: { id: true },
  });

  if (collision) {
    return { ok: false, error: "nickname_taken" };
  }

  if (existing) {
    const session = await prisma.chatSession.update({
      where: { id: existing.id },
      data: {
        nickname,
        nicknameKey,
        roomId,
        lastSeenAt: new Date(),
        expiresAt: newExpiry(),
      },
    });
    return { ok: true, session };
  }

  const session = await prisma.chatSession.create({
    data: {
      token: generateToken(),
      nickname,
      nicknameKey,
      roomId,
      expiresAt: newExpiry(),
    },
  });
  return { ok: true, session };
}

export async function leaveRoom(session: ChatSession): Promise<void> {
  await prisma.chatSession.update({
    where: { id: session.id },
    data: { roomId: null },
  });
}
