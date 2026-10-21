import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/types/chat";

function byCreatedAt(a: ChatMessage, b: ChatMessage) {
  const cmp = a.createdAt.localeCompare(b.createdAt);
  if (cmp !== 0) return cmp;
  return a.id.localeCompare(b.id);
}

describe("byCreatedAt compound ordering", () => {
  it("sorts strictly by timestamp when timestamps differ", () => {
    const m1: ChatMessage = {
      id: "b",
      roomId: "room-1",
      nickname: "Alice",
      body: "second",
      clientKey: "k2",
      createdAt: "2026-01-01T00:00:02.000Z",
      status: "sent",
    };
    const m2: ChatMessage = {
      id: "a",
      roomId: "room-1",
      nickname: "Bob",
      body: "first",
      clientKey: "k1",
      createdAt: "2026-01-01T00:00:01.000Z",
      status: "sent",
    };

    const sorted = [m1, m2].sort(byCreatedAt);
    expect(sorted.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("stably breaks ties by ID when timestamps are identical", () => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    const m1: ChatMessage = {
      id: "msg-z",
      roomId: "room-1",
      nickname: "Alice",
      body: "Z",
      clientKey: "k-z",
      createdAt: timestamp,
      status: "sent",
    };
    const m2: ChatMessage = {
      id: "msg-a",
      roomId: "room-1",
      nickname: "Bob",
      body: "A",
      clientKey: "k-a",
      createdAt: timestamp,
      status: "sent",
    };

    const sorted = [m1, m2].sort(byCreatedAt);
    expect(sorted.map((m) => m.id)).toEqual(["msg-a", "msg-z"]);
  });
});
