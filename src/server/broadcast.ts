import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  REALTIME_EVENT_MESSAGE_CREATED,
  realtimeChannelForRoom,
  type PublicMessage,
} from "@/types/chat";

/**
 * Publishes a persisted message to the room's Realtime Broadcast channel.
 *
 * Delivery strategy (the single mechanism this app uses — see README
 * "Real-time architecture"): the server publishes a Broadcast event over
 * the Supabase Realtime websocket *after* the Prisma insert has
 * successfully committed. We deliberately do not use Postgres Changes
 * (replication-based, single-threaded, and would mean standing up RLS
 * policies on a system schema for no benefit here) and we do not have the
 * client broadcast its own send — only the server, once the row is
 * durably persisted, tells other room participants about it. This keeps
 * "persisted" and "delivered" from racing each other: if the broadcast
 * call fails (network blip, Realtime hiccup), the message is still safely
 * in Postgres, and other clients will pick it up on their next history
 * fetch or reconnect (see useRealtimeMessages' reconciliation fetch).
 *
 * A failure here is intentionally non-fatal to the request — the sender
 * already has their message persisted and optimistically rendered; we log
 * and move on rather than erroring out an otherwise-successful send.
 */
export async function broadcastMessage(
  roomSlug: string,
  message: PublicMessage,
): Promise<void> {
  try {
    const channel = getSupabaseAdmin().channel(realtimeChannelForRoom(roomSlug));
    await channel.send({
      type: "broadcast",
      event: REALTIME_EVENT_MESSAGE_CREATED,
      payload: message,
    });
    // The admin client's channel is lightweight; we don't keep it
    // subscribed between requests, so remove it to free the socket.
    await getSupabaseAdmin().removeChannel(channel);
  } catch (err) {
    console.error("[broadcast] failed to publish message_created", err);
  }
}
