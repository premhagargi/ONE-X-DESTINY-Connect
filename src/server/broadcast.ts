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
 * Uses Supabase's high-speed REST Broadcast API for sub-20ms delivery in
 * serverless environments without WebSocket connection churn. Falls back
 * to the Supabase JS admin client if needed.
 *
 * A failure here is intentionally non-fatal to the request — the sender
 * already has their message persisted and optimistically rendered; other
 * clients recover missing messages seamlessly via history reconciliation.
 */
export async function broadcastMessage(
  roomSlug: string,
  message: PublicMessage,
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    try {
      const topic = realtimeChannelForRoom(roomSlug);
      // Supabase Realtime REST Broadcast endpoint
      const endpoint = `${url.replace(/\/+$/, "")}/realtime/v1/api/broadcast`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              topic,
              event: REALTIME_EVENT_MESSAGE_CREATED,
              payload: message,
            },
          ],
        }),
      });

      if (res.ok) {
        return;
      }
      console.warn("[broadcast] REST broadcast returned status", res.status);
    } catch (err) {
      console.warn("[broadcast] REST broadcast failed, trying SDK fallback", err);
    }
  }

  // Fallback to Supabase JS admin channel
  try {
    const admin = getSupabaseAdmin();
    const channel = admin.channel(realtimeChannelForRoom(roomSlug));
    await channel.send({
      type: "broadcast",
      event: REALTIME_EVENT_MESSAGE_CREATED,
      payload: message,
    });
    await admin.removeChannel(channel);
  } catch (err) {
    console.error("[broadcast] failed to publish message_created", err);
  }
}
