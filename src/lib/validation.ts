import { z } from "zod";
import {
  MESSAGE_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_PATTERN,
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
      ),
  );

export function nicknameKeyOf(nickname: string): string {
  return nickname.toLowerCase();
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
      .max(MESSAGE_MAX_LENGTH, `Message can't exceed ${MESSAGE_MAX_LENGTH} characters.`),
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
