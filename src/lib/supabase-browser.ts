"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client, used only for Realtime subscriptions
 * (chat messages arrive via Broadcast, published by the server — see
 * src/server/broadcast.ts). It uses the public anon key, which is safe to
 * expose; it never touches the database directly (no `.from(...)` calls),
 * so no table-level RLS is relied on for message delivery.
 */
let client: SupabaseClient | null | undefined;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    client = null;
    return null;
  }

  client = createClient(url, key, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
  return client;
}
