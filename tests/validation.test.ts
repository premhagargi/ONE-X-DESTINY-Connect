import { describe, expect, it } from "vitest";
import {
  messageBodySchema,
  nicknameKeyOf,
  nicknameSchema,
  normalizeNickname,
  clientKeySchema,
  roomSlugSchema,
} from "@/lib/validation";
import { MESSAGE_MAX_LENGTH, NICKNAME_MAX_LENGTH } from "@/lib/constants";

describe("nicknameSchema", () => {
  it("accepts a normal nickname", () => {
    const result = nicknameSchema.safeParse("Wandering Owl");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Wandering Owl");
  });

  it("trims and collapses internal whitespace", () => {
    const result = nicknameSchema.safeParse("  Wandering   Owl  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Wandering Owl");
  });

  it("rejects a too-short nickname", () => {
    expect(nicknameSchema.safeParse("A").success).toBe(false);
  });

  it("rejects a too-long nickname", () => {
    const tooLong = "A".repeat(NICKNAME_MAX_LENGTH + 1);
    expect(nicknameSchema.safeParse(tooLong).success).toBe(false);
  });

  it("rejects disallowed characters (e.g. angle brackets, emoji flags of impersonation)", () => {
    expect(nicknameSchema.safeParse("<script>").success).toBe(false);
    expect(nicknameSchema.safeParse("admin@site.com").success).toBe(false);
  });

  it("allows internal punctuation like apostrophes and hyphens", () => {
    expect(nicknameSchema.safeParse("Jean-Luc").success).toBe(true);
    expect(nicknameSchema.safeParse("O'Malley").success).toBe(true);
  });

  it("strips invisible/zero-width characters before validating", () => {
    const withZeroWidth = "Wand​ering Owl";
    const result = nicknameSchema.safeParse(withZeroWidth);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Wandering Owl");
  });
});

describe("normalizeNickname / nicknameKeyOf", () => {
  it("produces the same key for visually-identical nicknames with different case", () => {
    expect(nicknameKeyOf(normalizeNickname("Wandering Owl"))).toBe(
      nicknameKeyOf(normalizeNickname("wandering owl")),
    );
  });

  it("produces the same key when a zero-width character is hidden inside one version", () => {
    const a = nicknameKeyOf(normalizeNickname("WanderingOwl"));
    const b = nicknameKeyOf(normalizeNickname("Wand​eringOwl"));
    expect(a).toBe(b);
  });
});

describe("messageBodySchema", () => {
  it("accepts a normal message", () => {
    const result = messageBodySchema.safeParse("Anyone been to Hampi recently?");
    expect(result.success).toBe(true);
  });

  it("rejects an empty message", () => {
    expect(messageBodySchema.safeParse("").success).toBe(false);
  });

  it("rejects a whitespace-only message", () => {
    expect(messageBodySchema.safeParse("    \n\t  ").success).toBe(false);
  });

  it("rejects a message over the max length", () => {
    const tooLong = "a".repeat(MESSAGE_MAX_LENGTH + 1);
    expect(messageBodySchema.safeParse(tooLong).success).toBe(false);
  });

  it("accepts a message exactly at the max length", () => {
    const exact = "a".repeat(MESSAGE_MAX_LENGTH);
    expect(messageBodySchema.safeParse(exact).success).toBe(true);
  });

  it("strips control characters but keeps newlines (multiline composer)", () => {
    const result = messageBodySchema.safeParse("line one\nline two");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("line one\nline two");
  });

  it("trims leading/trailing whitespace", () => {
    const result = messageBodySchema.safeParse("  hello  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("hello");
  });
});

describe("clientKeySchema", () => {
  it("accepts a UUID-shaped key", () => {
    expect(clientKeySchema.safeParse("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d").success).toBe(
      true,
    );
  });

  it("rejects an empty or too-short key", () => {
    expect(clientKeySchema.safeParse("abc").success).toBe(false);
  });

  it("rejects keys with disallowed characters", () => {
    expect(clientKeySchema.safeParse("not a valid key!!").success).toBe(false);
  });
});

describe("roomSlugSchema", () => {
  it("accepts a lowercase-hyphen slug", () => {
    expect(roomSlugSchema.safeParse("solo-travel").success).toBe(true);
  });

  it("rejects uppercase or spaces", () => {
    expect(roomSlugSchema.safeParse("Solo Travel").success).toBe(false);
  });
});
