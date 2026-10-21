/**
 * The public shape of a message as sent over the wire — to the HTTP API
 * and to Realtime Broadcast payloads alike. Deliberately excludes
 * `sessionId` (an internal, session-identifying field) and any moderation
 * metadata, per the "don't expose private session identifiers or
 * moderation metadata in public message payloads" requirement.
 */
export interface PublicMessage {
  id: string;
  roomId: string;
  nickname: string;
  body: string;
  clientKey: string;
  createdAt: string; // ISO 8601
}

export interface HistoryPage {
  messages: PublicMessage[];
  /** Pass as `?before=` to fetch the next (older) page. Null when there is
   * no older history. */
  nextCursor: string | null;
}

/** Client-side message state, layered on top of PublicMessage. `status`
 * tracks the optimistic-send lifecycle (see useRealtimeMessages). */
export interface ChatMessage extends PublicMessage {
  status: "sending" | "sent" | "failed";
}

export const REALTIME_EVENT_MESSAGE_CREATED = "message_created";

export function realtimeChannelForRoom(roomSlug: string): string {
  return `room:${roomSlug}`;
}
