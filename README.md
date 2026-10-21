# ONE-X-DESTINY Connect — Anonymous Travel Group Chat (MVP)

A lightweight, anonymous, topic-based group chat for travelers: pick a room,
pick a nickname, start talking. No account, no email, no profile.

This is a standalone project — it shares no code, branding, or database
with any other site.

---

## Contents

- [What's here](#whats-here)
- [Stack, and why](#stack-and-why)
- [Architecture](#architecture)
  - [Real-time delivery strategy](#real-time-delivery-strategy)
  - [Anonymous session model](#anonymous-session-model)
  - [Data model](#data-model)
- [Setup](#setup)
- [Running it](#running-it)
- [Testing](#testing)
- [Deploying (free tier)](#deploying-free-tier)
- [Moderation](#moderation)
- [Retention](#retention)
- [Troubleshooting](#troubleshooting)
- [What was and wasn't verified in this build](#what-was-and-wasnt-verified-in-this-build)
- [Known limitations](#known-limitations)
- [Research sources](#research-sources)

---

## What's here

- A landing page listing the open rooms (seeded, not user-created).
- A nickname-entry flow — no registration.
- A real-time chat screen per room, with optimistic sending, proper
  scrolling, pagination, reconnect recovery, and inline moderation
  reporting.
- A minimal, header-secret-protected admin API for removing messages and
  suspending abusive sessions.
- A scheduled retention-cleanup endpoint.
- A test suite covering validation, idempotency, pagination, and rate
  limiting logic (see [Testing](#testing) for what is and isn't exercised
  without live credentials).

## Stack, and why

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | One deployable for UI + API, first-class Vercel free-tier support. |
| Database | Supabase Postgres (free tier) | Managed Postgres with a generous free tier and a Realtime service already attached. |
| ORM | Prisma 7, with the `pg` driver adapter (`@prisma/adapter-pg`) | Explicit schema + migrations, proper pooled connections for serverless. |
| Real-time | Supabase Realtime **Broadcast** | See below — chosen over Postgres Changes. |
| Styling | Tailwind CSS v4 | Small footprint, no component-library bloat. |
| Hosting | Vercel (Hobby) | Free tier, Cron support for retention cleanup. |

## Architecture

```
src/
  app/
    page.tsx                  landing page (room list)
    rooms/[slug]/page.tsx      nickname gate OR chat screen (SSR)
    privacy/page.tsx           plain-language privacy/safety page
    api/
      rooms/[slug]/join        POST — nickname validation + session issue
      rooms/[slug]/leave       POST — clears current room from session
      rooms/[slug]/messages    GET (history/reconcile) + POST (send)
      messages/[id]/report     POST — report a message
      admin/...                protected moderation endpoints
      cron/cleanup             protected retention job
  components/                  UI: ChatRoom, Composer, MessageBubble, ...
  hooks/                       useRealtimeMessages, useAutoScroll
  server/                      session, rooms, messages, moderation, rate-limit
  lib/                         prisma client, supabase clients, validation, constants
  types/chat.ts                shared wire types
prisma/
  schema.prisma                source of truth for the DB schema
  seed.ts                      seeds the 6 predefined rooms
  sql/manual_schema.sql        hand-written reference copy (see note in the file)
tests/                         vitest unit tests
```

### Real-time delivery strategy

**We use Supabase Realtime Broadcast, published from the server after a
successful write — not Postgres Changes, and not client-originated
broadcasts.** Research into both mechanisms (Supabase's own guidance, see
[Research sources](#research-sources)) is consistent: Postgres Changes is
replication-based and effectively single-threaded per project, with no
delivery guarantee, while Broadcast is the documented choice for
chat-shaped, high-frequency, client-to-client fan-out. Using Postgres
Changes here would also mean standing up Row Level Security policies on
Realtime's own schema for no real benefit, since our rooms aren't access
controlled per user.

The flow (`src/hooks/useRealtimeMessages.ts`, `src/server/broadcast.ts`):

1. **Optimistic render** — `Composer` calls `sendMessage()`, which appends
   a `status: "sending"` bubble to the UI immediately, before any network
   call.
2. **Server validation + persistence** — `POST /api/rooms/:slug/messages`
   validates the body, rate-limits, and writes the row via Prisma.
3. **Broadcast to others** — only *after* the write commits, the server
   publishes a `message_created` Broadcast event to that room's channel
   (`room:<slug>`) using the Supabase service-role client.
4. **Reconciliation** — the sender reconciles their own bubble against the
   **HTTP response** (not the broadcast), matched by a client-generated
   `clientKey`. Everyone's state — sender and other participants alike —
   funnels through the same `upsertMessage(clientKey)` function, so if the
   broadcast happens to also reach the sender, it's a harmless no-op
   upsert, never a duplicate.
5. **Reconnect recovery** — every time the Realtime channel (re)subscribes
   after having been disconnected, the client calls
   `GET /messages?since=<newest-known-id>` to pull anything it might have
   missed. Persistence (step 2) never depends on delivery (step 3)
   succeeding — a dropped broadcast is always recoverable from the
   database this way.

A message is idempotent on `(roomId, clientKey)` (a unique constraint in
the schema) — a retried send after a flaky "did that actually go through?"
response safely returns the original row instead of creating a duplicate.

### Anonymous session model

See `src/server/session.ts` for the full writeup in code, and `/privacy`
for the plain-language version shown to users. Summary:

- The browser holds exactly one credential: an **HttpOnly** cookie with a
  random session token. Page JavaScript cannot read it.
- The token resolves to a `ChatSession` row server-side on each request
  that needs identity. The session's database ID is never sent to the
  browser.
- A nickname is only unique **within the room it's currently used in**,
  checked server-side against other non-expired sessions — never a
  substitute for the cookie as a credential, so changing your nickname or
  editing local storage cannot impersonate someone else's session.
- Being anonymous to other participants does not mean invisible to the
  operator: the service still knows which (opaque) session sent which
  message, so a report can be acted on. This is stated plainly on
  `/privacy`, not left implicit.

### Data model

See `prisma/schema.prisma` (the source of truth, with inline comments
explaining each non-obvious choice) for `Room`, `ChatSession`, `Message`,
and `Report`. Notable points:

- `Message.sessionId` is **nullable** with `onDelete: SetNull` (not
  `Cascade`): a session can expire (7-day TTL) well before its messages
  hit the 30-day retention window, and cascading the delete would wipe
  live chat history just because the *sender's* session record aged out.
  Only the link is cleared; the message body/nickname snapshot stays.
- `Message` has a unique `(roomId, clientKey)` index — the idempotency
  mechanism described above.
- `Message` and history queries are indexed on `(roomId, createdAt)`,
  which is what both the "latest 50" and "older than cursor X" queries
  use.

## Setup

1. **Create a Supabase project** (free tier) at
   [supabase.com](https://supabase.com).
2. **Get your connection strings**: Project Settings → Database →
   Connection string. You need both the **Transaction pooler** (port
   6543) and **Direct connection** (port 5432) strings.
3. **Get your API keys**: Project Settings → API → Project URL,
   `anon`/`public` key, and `service_role` key.
4. **Copy env vars**:
   ```bash
   cp .env.example .env
   ```
   Fill in `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Generate two separate random strings
   for `ADMIN_SECRET` and `CRON_SECRET` (e.g. `openssl rand -hex 32`).
5. **Install dependencies**:
   ```bash
   npm install
   ```
6. **Generate the Prisma client and apply the schema**:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
   This needs outbound network access to `binaries.prisma.sh` (Prisma
   downloads a small native engine on first `generate`) — see
   [What was and wasn't verified](#what-was-and-wasnt-verified-in-this-build)
   for why that step couldn't be run in the sandbox this was built in, and
   do this from your own machine/CI instead.
7. **Seed the rooms**:
   ```bash
   npm run db:seed
   ```
8. **Run it**: see [Running it](#running-it) below.

## Running it

```bash
npm run dev       # http://localhost:3000
npm run build && npm run start   # production build, locally
npm run lint
npm run typecheck
npm test
```

## Testing

```bash
npm test
```

Covers, with Prisma mocked so no database is required:
- Nickname/message/clientKey/room-slug validation, including the
  zero-width-character normalization that keeps nickname uniqueness
  consistent.
- History pagination (`getHistoryPage`): correct ordering, `nextCursor`
  behavior, and that a cursor from a different room yields no results
  rather than leaking that room's data.
- `getMessagesSince` (the reconnect-reconciliation query).
- Send idempotency (`createMessage`): a duplicate `clientKey` returns the
  original row instead of erroring or duplicating; a genuine database
  error still propagates.
- The duplicate-message spam check.
- The IP-based join rate limiter, including window expiry.

**Not covered by this suite, and why**: end-to-end flows (two real
browser sessions joining a room, sending, seeing realtime delivery,
reconnecting) need a live Supabase project and a running app, so they
aren't automated here. The [manual test checklist](#manual-test-checklist)
below is what to run once you have real credentials configured. Message
and report *rate limiting* (as opposed to the pure-logic join limiter)
query Prisma directly rather than going through an injectable interface,
so they're exercised by code inspection and the manual checklist rather
than a mocked unit test — a reasonable MVP-scope trade-off, noted here
rather than silently skipped.

### Manual test checklist

Run these once you have a configured, running instance:

- [ ] Choose a nickname, join a room, see the chat screen.
- [ ] Open the same room in a second browser (or private window), send a
      message from each, confirm both arrive on both — the sender sees it
      instantly, the other side sees it without a refresh.
- [ ] Refresh the page — history persists, in order.
- [ ] Scroll up — older messages load without the view jumping.
- [ ] While scrolled up, have the other session send a message — a "N new
      messages" button appears instead of yanking you to the bottom.
- [ ] Turn off your network briefly, send a message, turn it back on —
      the composer shows the offline state, the draft isn't lost, and a
      failed send shows a Retry affordance.
- [ ] Try to join a room with a nickname already active in it — rejected
      with a clear message.
- [ ] Send an empty message, a 1000+ character message, the same message
      twice in a row quickly — all rejected client- and server-side.
- [ ] Report a message (`/api/messages/:id/report`) and confirm it shows
      up via `GET /api/admin/reports` with your `ADMIN_SECRET`.
- [ ] Delete a message via the admin endpoint and confirm it disappears
      from the room for other participants.
- [ ] Load the app at 320px, 375px, 390px, 430px, 768px, and desktop
      widths — no horizontal scroll, composer stays usable with the
      on-screen keyboard open.

## Deploying (free tier)

**Supabase (free tier)** — confirm current limits in your dashboard before
relying on them; as of this build, the free tier includes a shared
Postgres instance with a storage cap, a cap on concurrent Realtime
connections, and the project pauses after a period of inactivity (a
paused project needs a manual or API-triggered resume, which means a
cold-start delay on the first request after a long idle period — expect
this on a quiet free-tier deployment).

**Vercel (Hobby, free tier)**:
1. Import this repository.
2. Add all the env vars from `.env.example` with your real values.
3. Deploy. `vercel.json` defines a daily Cron job
   (`/api/cron/cleanup`) — Vercel automatically sends
   `Authorization: Bearer <CRON_SECRET>` on cron-triggered requests when a
   `CRON_SECRET` env var is set, which is exactly what the cleanup route
   checks. The Hobby plan allows at most one cron run per day, which is
   more than enough for a 30-day retention window.
4. If your plan/project doesn't have Cron available, the retention job is
   still just a protected HTTP endpoint — call it from any external
   scheduler (a free GitHub Actions cron job, for instance) with the same
   bearer token. It's idempotent and safe to call more often than needed.

Function runtime, build-minute, and bandwidth limits on Vercel Hobby
change periodically — check the current numbers on Vercel's pricing page
before launch if you expect meaningful traffic.

## Moderation

Deliberately not a dashboard — two protected endpoints, callable with
`curl` or any HTTP client, using the `ADMIN_SECRET` you set:

```bash
# List open reports
curl -H "x-admin-secret: $ADMIN_SECRET" https://your-app/api/admin/reports

# Remove a message
curl -X DELETE -H "x-admin-secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Spam link", "reportId":"<optional>"}' \
  https://your-app/api/admin/messages/<message-id>

# Suspend a session
curl -X POST -H "x-admin-secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Repeated harassment"}' \
  https://your-app/api/admin/sessions/<session-id>/suspend
```

**What this does and doesn't prevent** (spec-required honesty, not just
hand-waving):
- Does: remove a specific message from a room; block a specific session
  from sending further messages or rejoining; rate-limit sends/reports per
  session; rate-limit joins per IP within a single warm server instance;
  reject spam-shaped duplicate messages; render all content as plain text
  (no HTML/Markdown interpretation anywhere — nothing a message body
  contains is ever parsed as markup, so there's no script-injection
  surface via chat content).
- Does not: verify a reporter's claim before it's queued (a human still
  reviews reports); prevent a determined abuser from creating a new
  session after being suspended (there's no real identity to ban, by
  design — anonymity is the product); rate-limit joins across multiple
  concurrent serverless instances (see
  [Known limitations](#known-limitations)); scan message content for
  harmful material automatically.

## Retention

`RETENTION_DAYS` (default 30, see `.env.example`) controls how long
messages are kept. `GET /api/cron/cleanup`, protected by `CRON_SECRET`,
deletes messages older than that window and any expired, non-suspended
sessions, and is wired to Vercel Cron (see
[Deploying](#deploying-free-tier)) with a documented manual/external
fallback if Cron isn't available on your plan.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `prisma generate` fails to fetch an engine | No network access to `binaries.prisma.sh` from wherever you're running it — check a firewall/proxy allowlist. |
| `DATABASE_URL is not set` at runtime | `.env` wasn't created from `.env.example`, or the process isn't loading it (Next.js loads `.env` automatically in dev; make sure your deploy platform has the same vars set). |
| Messages save but never appear for other tabs | Check `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are correct (server broadcast) and `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct (client subscribe) — a typo in either silently breaks only one side. |
| "Nickname already in use" immediately after rejoining with your own name | Expected if your previous session's cookie wasn't sent (e.g. you cleared cookies) — your old session is still "active" until its 7-day TTL lapses; pick a different nickname or wait, or reduce `SESSION_TTL_MS` in `src/lib/constants.ts` for testing. |
| 429 on send | Rate limit (`RATE_LIMIT_MESSAGES` in `src/lib/constants.ts`) or the duplicate-message guard — check the response `error` field to tell which. |
| Supabase project "paused" / first request hangs | Free-tier auto-pause after inactivity — resume it from the Supabase dashboard (or its API) and retry. |

## What was and wasn't verified in this build

Built and verified here, with evidence:
- `npm run lint` — passes, zero errors/warnings.
- `npm run test` — 37/37 tests pass (`npx vitest run`).
- `npx tsc --noEmit` on everything that doesn't depend on the generated
  Prisma client (components, hooks, validation, route-handler logic
  structure) — clean.

**Not run, and why, stated plainly rather than faked**: this build
sandbox's outbound network policy does not allow reaching
`binaries.prisma.sh`, which `npx prisma generate` needs to download
Prisma's query engine on first run. Without a generated client,
`@prisma/client` has no `PrismaClient`/model exports, which means:
- `npx tsc --noEmit` currently reports errors in every file that imports
  `@prisma/client` (`src/lib/prisma.ts`, `src/server/session.ts`,
  `src/server/messages.ts`, `src/components/RoomRow.tsx`,
  `prisma/seed.ts`, and one cascading implicit-`any` in `src/app/page.tsx`)
  — all eight errors trace directly to the same missing-export root
  cause, confirmed by reading each one individually rather than assumed.
- `npm run build` (`next build`) could not be run to completion for the
  same reason.
- The live end-to-end flow (two browsers, real Supabase project,
  send/receive/reconnect) could not be executed here — there is no
  Supabase project connected to this sandbox. This is exactly why the
  [manual test checklist](#manual-test-checklist) above exists: run it
  yourself once `npx prisma generate && npx prisma migrate dev` has
  succeeded against your own Supabase project, which simply needs a
  machine with normal internet access (true for essentially any dev
  machine or CI runner — this was a constraint of this particular sandbox,
  not of the Prisma/Supabase/Vercel stack itself).

Everything else in this README — architecture, setup steps, API shapes —
describes what the code actually does, not aspirational behavior.

## Known limitations

- **Join rate limiting is per-server-instance, in-memory** (see
  `src/server/rate-limit.ts`). On Vercel, concurrent serverless instances
  don't share this counter, so it throttles a single sustained abuser but
  not a distributed one. Message and report rate limiting don't have this
  gap (they query Postgres). A durable fix (e.g. Upstash Redis's free
  tier) is a reasonable follow-up, intentionally not added here to avoid
  introducing another paid-tier dependency for an MVP.
- **No image/file uploads, voice, calls, reactions, or DMs** — out of
  scope by design (see the original spec).
- **Suspending a session doesn't prevent a new one** — there's no durable
  identity to ban in an anonymous product; suspension stops the
  *specific* session a moderator acted on.
- **Supabase free-tier project pausing** means a long-idle deployment's
  first request after a while can be slow (cold resume) — see
  [Deploying](#deploying-free-tier).

## Research sources

Consulted while making the architecture decisions above (see inline code
comments for where each one was applied):

- WhatsApp Web / Telegram Web — message bubble layout, Enter-to-send,
  optimistic rendering, and scroll-follow conventions (general product
  observation, informing `Composer.tsx` and `useAutoScroll.ts`; no
  WhatsApp/Telegram code, branding, or exact UI was copied).
- Supabase, Realtime: Broadcast and Realtime: Postgres Changes official
  docs (`supabase.com/docs/guides/realtime/broadcast`,
  `supabase.com/docs/guides/realtime/postgres-changes`), plus Supabase's
  own "Realtime or Pipelines" guidance
  (`supabase.com/blog/realtime-or-pipelines-how-to-choose-the-right-tool`)
  — the basis for choosing Broadcast over Postgres Changes (see
  [Real-time delivery strategy](#real-time-delivery-strategy)).
- Prisma, Supabase connection guide
  (`prisma.io/docs/orm/overview/databases/supabase`) — the pooled-vs-direct
  connection string split (`DATABASE_URL` / `DIRECT_URL`) used in
  `prisma/schema.prisma` and `src/lib/prisma.ts`.
