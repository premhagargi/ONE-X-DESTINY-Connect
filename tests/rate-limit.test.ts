import { beforeEach, describe, expect, it, vi } from "vitest";

// src/server/rate-limit.ts imports the Prisma singleton at module scope
// (for the DB-backed message/report limiters); stub it so this file can
// load without a generated Prisma client — isJoinRateLimited itself never
// touches the database.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// isJoinRateLimited is the one rate-limit function with no DB dependency
// (see src/server/rate-limit.ts for why message/report limiting is
// DB-backed instead) — the other two are exercised indirectly via
// tests/messages.test.ts's mocked-Prisma approach where relevant.
import { isJoinRateLimited } from "@/server/rate-limit";
import { RATE_LIMIT_JOIN } from "@/lib/constants";

describe("isJoinRateLimited", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const ip = `ip-under-${Math.random()}`;
    for (let i = 0; i < RATE_LIMIT_JOIN.max; i++) {
      expect(isJoinRateLimited(ip)).toBe(false);
    }
  });

  it("blocks once the limit is exceeded within the window", () => {
    const ip = `ip-over-${Math.random()}`;
    for (let i = 0; i < RATE_LIMIT_JOIN.max; i++) {
      isJoinRateLimited(ip);
    }
    expect(isJoinRateLimited(ip)).toBe(true);
  });

  it("tracks different IPs independently", () => {
    const ipA = `ip-a-${Math.random()}`;
    const ipB = `ip-b-${Math.random()}`;
    for (let i = 0; i < RATE_LIMIT_JOIN.max; i++) {
      isJoinRateLimited(ipA);
    }
    expect(isJoinRateLimited(ipA)).toBe(true);
    expect(isJoinRateLimited(ipB)).toBe(false);
  });

  it("allows requests again once the window has passed", () => {
    vi.useFakeTimers();
    const ip = `ip-window-${Math.random()}`;
    const start = Date.now();
    vi.setSystemTime(start);

    for (let i = 0; i < RATE_LIMIT_JOIN.max; i++) {
      isJoinRateLimited(ip);
    }
    expect(isJoinRateLimited(ip)).toBe(true);

    vi.setSystemTime(start + RATE_LIMIT_JOIN.windowMs + 1);
    expect(isJoinRateLimited(ip)).toBe(false);

    vi.useRealTimers();
  });
});
