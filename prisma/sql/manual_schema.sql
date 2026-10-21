-- Hand-written reference copy of the schema in prisma/schema.prisma.
--
-- This is NOT a Prisma-generated migration (this build environment could
-- not reach binaries.prisma.sh to run the Prisma engine — see README
-- "What was and wasn't verified"). It exists as a fallback / sanity-check
-- only. The supported path is:
--
--   npx prisma migrate dev --name init
--
-- run from your own machine against DIRECT_URL, which will generate the
-- real prisma/migrations/ folder from schema.prisma. Use this file only if
-- you want to eyeball the expected shape, or apply it by hand in the
-- Supabase SQL editor as a last resort (in which case also run
-- `npx prisma migrate resolve --applied <migration-name>` afterwards so
-- Prisma's migration history matches reality).

CREATE TABLE "rooms" (
    "id" TEXT PRIMARY KEY,
    "slug" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "chat_sessions" (
    "id" TEXT PRIMARY KEY,
    "token" TEXT NOT NULL UNIQUE,
    "nickname" TEXT NOT NULL,
    "nickname_key" TEXT NOT NULL,
    "room_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspended_reason" TEXT
);
CREATE INDEX "chat_sessions_room_id_nickname_key_idx" ON "chat_sessions" ("room_id", "nickname_key");

CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED');

CREATE TABLE "messages" (
    "id" TEXT PRIMARY KEY,
    "room_id" TEXT NOT NULL,
    "session_id" TEXT,
    "nickname" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "client_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_reason" TEXT,
    CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE,
    CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL
);
CREATE INDEX "messages_room_id_created_at_idx" ON "messages" ("room_id", "created_at");
CREATE UNIQUE INDEX "messages_room_id_client_key_key" ON "messages" ("room_id", "client_key");

CREATE TABLE "reports" (
    "id" TEXT PRIMARY KEY,
    "message_id" TEXT,
    "session_id" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL,
    CONSTRAINT "reports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL
);
CREATE INDEX "reports_status_created_at_idx" ON "reports" ("status", "created_at");
