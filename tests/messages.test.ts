import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Mocks both the generated Prisma client and our lib/prisma singleton, so
 * this test exercises the actual pagination / idempotency logic in
 * src/server/messages.ts without needing a real database — or a
 * `prisma generate` run, which this sandbox's network policy couldn't
 * complete (see README "What was and wasn't verified"). The mocked
 * `PrismaClientKnownRequestError` mirrors the real one closely enough
 * (a `code` property) for the P2002-handling branch under test.
 */
class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const db = {
  message: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: db }));

const { getHistoryPage, getMessagesSince, createMessage, isRepeatedMessage } = await import(
  "@/server/messages"
);

function msg(id: string, createdAt: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    roomId: "room-1",
    nickname: "Owl",
    body: `msg ${id}`,
    clientKey: `key-${id}`,
    createdAt: new Date(createdAt),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getHistoryPage", () => {
  it("returns the most recent page, oldest-first, with no cursor", async () => {
    // Service requests take+1 rows desc to detect "more"; return exactly
    // `take` to simulate "no more history".
    db.message.findMany.mockResolvedValueOnce([
      msg("3", "2026-01-03T00:00:00Z"),
      msg("2", "2026-01-02T00:00:00Z"),
      msg("1", "2026-01-01T00:00:00Z"),
    ]);

    const page = await getHistoryPage("room-1", null);

    expect(page.messages.map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(page.nextCursor).toBeNull();
    expect(db.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roomId: "room-1", isDeleted: false }),
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("sets nextCursor and trims to page size when there is more history", async () => {
    // take = HISTORY_PAGE_SIZE = 50 for first page; simulate 51 rows back.
    const rows = Array.from({ length: 51 }, (_, i) =>
      msg(String(51 - i), `2026-01-01T00:${String(51 - i).padStart(2, "0")}:00Z`),
    );
    db.message.findMany.mockResolvedValueOnce(rows);

    const page = await getHistoryPage("room-1", null);

    expect(page.messages).toHaveLength(50);
    expect(page.nextCursor).toBe(page.messages[0].id);
  });

  it("scopes the cursor lookup to the given room, so a foreign-room id yields no results", async () => {
    db.message.findFirst.mockResolvedValueOnce(null); // not found within this room
    const page = await getHistoryPage("room-1", "msg-from-another-room");
    expect(page).toEqual({ messages: [], nextCursor: null });
    expect(db.message.findMany).not.toHaveBeenCalled();
  });

  it("queries older-than the cursor's timestamp when a valid cursor is given", async () => {
    db.message.findFirst.mockResolvedValueOnce({ createdAt: new Date("2026-01-05T00:00:00Z") });
    db.message.findMany.mockResolvedValueOnce([]);

    await getHistoryPage("room-1", "cursor-id");

    expect(db.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roomId: "room-1",
          createdAt: { lt: new Date("2026-01-05T00:00:00Z") },
        }),
      }),
    );
  });
});

describe("getMessagesSince", () => {
  it("returns an empty array for an unknown/foreign cursor", async () => {
    db.message.findFirst.mockResolvedValueOnce(null);
    const result = await getMessagesSince("room-1", "nope");
    expect(result).toEqual([]);
  });

  it("returns messages strictly after the cursor, ascending", async () => {
    db.message.findFirst.mockResolvedValueOnce({ createdAt: new Date("2026-01-01T00:00:00Z") });
    db.message.findMany.mockResolvedValueOnce([
      msg("2", "2026-01-01T00:01:00Z"),
      msg("3", "2026-01-01T00:02:00Z"),
    ]);

    const result = await getMessagesSince("room-1", "1");
    expect(result.map((m) => m.id)).toEqual(["2", "3"]);
  });
});

describe("createMessage (idempotency)", () => {
  it("creates a new message normally", async () => {
    db.message.create.mockResolvedValueOnce(msg("1", "2026-01-01T00:00:00Z"));

    const result = await createMessage({
      roomId: "room-1",
      sessionId: "session-1",
      nickname: "Owl",
      body: "hi",
      clientKey: "key-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message.id).toBe("1");
    expect(result.ok && result.deduped).toBe(false);
  });

  it("returns the original row instead of erroring on a duplicate clientKey (retry-safe send)", async () => {
    db.message.create.mockRejectedValueOnce(
      new FakePrismaClientKnownRequestError("unique constraint", "P2002"),
    );
    db.message.findUnique.mockResolvedValueOnce(msg("1", "2026-01-01T00:00:00Z"));

    const result = await createMessage({
      roomId: "room-1",
      sessionId: "session-1",
      nickname: "Owl",
      body: "hi",
      clientKey: "key-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message.id).toBe("1");
      expect(result.ok && result.deduped).toBe(true);
    }
  });

  it("rethrows non-duplicate database errors", async () => {
    db.message.create.mockRejectedValueOnce(new Error("connection lost"));
    await expect(
      createMessage({
        roomId: "room-1",
        sessionId: "session-1",
        nickname: "Owl",
        body: "hi",
        clientKey: "key-1",
      }),
    ).rejects.toThrow("connection lost");
  });
});

describe("isRepeatedMessage", () => {
  it("is false when there is no history", async () => {
    db.message.findMany.mockResolvedValueOnce([]);
    expect(await isRepeatedMessage("room-1", "session-1", "hi", 3)).toBe(false);
  });

  it("is true when the lookback window is all identical to the new body", async () => {
    db.message.findMany.mockResolvedValueOnce([{ body: "hi" }, { body: "hi" }, { body: "hi" }]);
    expect(await isRepeatedMessage("room-1", "session-1", "hi", 3)).toBe(true);
  });

  it("is false when any recent message differs", async () => {
    db.message.findMany.mockResolvedValueOnce([{ body: "hi" }, { body: "something else" }]);
    expect(await isRepeatedMessage("room-1", "session-1", "hi", 3)).toBe(false);
  });
});
