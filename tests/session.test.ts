import { describe, expect, it, vi, beforeEach } from "vitest";

const db = {
  chatSession: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(async () => cookieStore),
}));

const {
  getCurrentSession,
  touchSession,
  setSessionCookie,
  clearSessionCookie,
  createOrRejoinSession,
  ensureRoomMembership,
  leaveRoom,
} = await import("@/server/session");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Session Management & Lifecycle", () => {
  it("getCurrentSession returns null if no session cookie exists", async () => {
    cookieStore.get.mockReturnValueOnce(undefined);
    const session = await getCurrentSession();
    expect(session).toBeNull();
    expect(db.chatSession.findUnique).not.toHaveBeenCalled();
  });

  it("getCurrentSession returns null if session row is not in database", async () => {
    cookieStore.get.mockReturnValueOnce({ value: "invalid-token" });
    db.chatSession.findUnique.mockResolvedValueOnce(null);

    const session = await getCurrentSession();
    expect(session).toBeNull();
    expect(db.chatSession.findUnique).toHaveBeenCalledWith({
      where: { token: "invalid-token" },
    });
  });

  it("getCurrentSession returns null if session has expired", async () => {
    cookieStore.get.mockReturnValueOnce({ value: "expired-token" });
    db.chatSession.findUnique.mockResolvedValueOnce({
      id: "sess-1",
      token: "expired-token",
      expiresAt: new Date(Date.now() - 1000 * 60), // expired 1 minute ago
    });

    const session = await getCurrentSession();
    expect(session).toBeNull();
  });

  it("getCurrentSession returns live session when token is valid and not expired", async () => {
    cookieStore.get.mockReturnValueOnce({ value: "valid-token" });
    const liveSession = {
      id: "sess-1",
      token: "valid-token",
      nickname: "Solo Wanderer",
      roomId: "room-1",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour left
    };
    db.chatSession.findUnique.mockResolvedValueOnce(liveSession);

    const session = await getCurrentSession();
    expect(session).toEqual(liveSession);
  });

  it("createOrRejoinSession blocks duplicate nickname taken by another user", async () => {
    db.chatSession.findFirst.mockResolvedValueOnce({ id: "other-user" });

    const result = await createOrRejoinSession({
      nickname: "Nomad",
      nicknameKey: "nomad",
      roomId: "room-1",
      existing: null,
    });

    expect(result).toEqual({ ok: false, error: "nickname_taken" });
    expect(db.chatSession.create).not.toHaveBeenCalled();
  });

  it("createOrRejoinSession allows reusing nickname if it belongs to the current session", async () => {
    db.chatSession.findFirst.mockResolvedValueOnce(null);
    db.chatSession.update.mockResolvedValueOnce({
      id: "sess-1",
      nickname: "Nomad",
      roomId: "room-1",
    });

    const result = await createOrRejoinSession({
      nickname: "Nomad",
      nicknameKey: "nomad",
      roomId: "room-1",
      existing: { id: "sess-1" } as any,
    });

    expect(result.ok).toBe(true);
    expect(db.chatSession.update).toHaveBeenCalled();
  });

  it("createOrRejoinSession creates new session row with unique token when no session exists", async () => {
    db.chatSession.findFirst.mockResolvedValueOnce(null);
    db.chatSession.create.mockResolvedValueOnce({
      id: "new-sess",
      token: "token-abc",
      nickname: "Alpine Trekker",
      roomId: "room-1",
    });

    const result = await createOrRejoinSession({
      nickname: "Alpine Trekker",
      nicknameKey: "alpine trekker",
      roomId: "room-1",
      existing: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.id).toBe("new-sess");
    }
    expect(db.chatSession.create).toHaveBeenCalled();
  });

  it("ensureRoomMembership returns immediately if already in target room", async () => {
    const existing = {
      id: "sess-1",
      nickname: "Nomad",
      roomId: "room-1",
    } as any;

    const result = await ensureRoomMembership(existing, "room-1");
    expect(result).toEqual({ ok: true, session: existing });
    expect(db.chatSession.findFirst).not.toHaveBeenCalled();
    expect(db.chatSession.update).not.toHaveBeenCalled();
  });

  it("ensureRoomMembership rejects if nickname is taken by someone else in target room", async () => {
    const existing = {
      id: "sess-1",
      nickname: "Nomad",
      nicknameKey: "nomad",
      roomId: "room-1",
    } as any;

    db.chatSession.findFirst.mockResolvedValueOnce({ id: "other-user" });

    const result = await ensureRoomMembership(existing, "room-2");
    expect(result).toEqual({ ok: false, error: "nickname_taken" });
    expect(db.chatSession.update).not.toHaveBeenCalled();
  });

  it("ensureRoomMembership updates roomId and extends expiry when joining target room without collision", async () => {
    const existing = {
      id: "sess-1",
      nickname: "Nomad",
      nicknameKey: "nomad",
      roomId: "room-1",
    } as any;

    db.chatSession.findFirst.mockResolvedValueOnce(null);
    const updatedSession = { ...existing, roomId: "room-2" };
    db.chatSession.update.mockResolvedValueOnce(updatedSession);

    const result = await ensureRoomMembership(existing, "room-2");
    expect(result).toEqual({ ok: true, session: updatedSession });
    expect(db.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess-1" },
        data: expect.objectContaining({ roomId: "room-2" }),
      }),
    );
  });

  it("leaveRoom clears roomId on the session row without deleting session token", async () => {
    db.chatSession.update.mockResolvedValueOnce({
      id: "sess-1",
      roomId: null,
    });

    await leaveRoom({ id: "sess-1" } as any);
    expect(db.chatSession.update).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: { roomId: null },
    });
  });

  it("touchSession skips database update if lastSeenAt is recent", async () => {
    const recentSession = {
      id: "sess-1",
      lastSeenAt: new Date(), // just now
    } as any;

    await touchSession(recentSession);
    expect(db.chatSession.update).not.toHaveBeenCalled();
  });

  it("setSessionCookie and clearSessionCookie configure HttpOnly cookie appropriately", async () => {
    await setSessionCookie("tok-123");
    expect(cookieStore.set).toHaveBeenCalledWith(
      expect.any(String),
      "tok-123",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );

    await clearSessionCookie();
    expect(cookieStore.delete).toHaveBeenCalledWith(expect.any(String));
  });
});
