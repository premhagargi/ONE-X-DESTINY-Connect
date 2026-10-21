import { z } from "zod";
import {
  MESSAGE_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_PATTERN,
  RESERVED_NICKNAMES,
} from "./constants";

/** Strips zero-width / bidi-control characters that are invisible but could
 * be used to make two visually-identical nicknames compare as different, or
 * vice versa. Run before length/pattern validation and before storage. */
function stripInvisible(input: string): string {
  return input.replace(/[​-‏‪-‮﻿]/g, "");
}

export function normalizeNickname(raw: string): string {
  return stripInvisible(raw).trim().replace(/\s+/g, " ");
}

const reservedSet = new Set(RESERVED_NICKNAMES.map((n) => n.toLowerCase()));

export function isReservedNickname(nickname: string): boolean {
  const normalized = normalizeNickname(nickname).toLowerCase();
  return reservedSet.has(normalized);
}

export const nicknameSchema = z
  .string()
  .transform(normalizeNickname)
  .pipe(
    z
      .string()
      .min(NICKNAME_MIN_LENGTH, "Nickname is too short.")
      .max(NICKNAME_MAX_LENGTH, "Nickname is too long.")
      .regex(
        NICKNAME_PATTERN,
        "Nickname can only contain letters, numbers, spaces, and . _ - '",
      )
      .refine(
        (val) => !isReservedNickname(val),
        "That nickname is reserved for system use. Please pick another.",
      ),
  );

export function nicknameKeyOf(nickname: string): string {
  return nickname.toLowerCase();
}

/**
 * Public safety & compliance guardrail:
 * - Rejects excessive link spam / phishing vectors (max 3 links per message)
 * - Detects and rejects payment card / credit card numbers for user safety
 */
export function validateMessageContentSafety(text: string): { ok: boolean; reason?: string } {
  const urlMatches = text.match(/https?:\/\/[^\s]+/gi) || [];
  if (urlMatches.length > 3) {
    return {
      ok: false,
      reason: "Message contains too many links (maximum 3 links allowed per message).",
    };
  }

  const ccPattern = /\b(?:\d[ -]*?){13,19}\b/;
  if (ccPattern.test(text)) {
    const matched = text.match(ccPattern)?.[0].replace(/[\s-]/g, "") ?? "";
    if (matched.length >= 13 && matched.length <= 19 && /^\d+$/.test(matched)) {
      return {
        ok: false,
        reason: "Sharing payment card numbers is blocked for privacy and fraud prevention.",
      };
    }
  }

  return { ok: true };
}

/** A message body is plain text only. We intentionally do not strip
 * formatting or links — we never interpret the content as HTML/Markdown
 * when rendering, so there's nothing to sanitize for XSS purposes beyond
 * normal React text escaping (see MessageBubble). We do still reject
 * control characters and enforce length. */
export const messageBodySchema = z
  .string()
  .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""))
  .pipe(
    z
      .string()
      .trim()
      .min(1, "Message can't be empty.")
      .max(MESSAGE_MAX_LENGTH, `Message can't exceed ${MESSAGE_MAX_LENGTH} characters.`)
      .superRefine((val, ctx) => {
        const safety = validateMessageContentSafety(val);
        if (!safety.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: safety.reason || "Message violates community safety guidelines.",
          });
        }
      }),
  );

export const clientKeySchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const roomSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);

export const reportReasonSchema = z.enum([
  "spam",
  "harassment",
  "scam_or_phishing",
  "inappropriate_content",
  "other",
]);
