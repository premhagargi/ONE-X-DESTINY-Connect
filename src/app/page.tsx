import Link from "next/link";
import { listActiveRooms } from "@/server/rooms";
import { getCurrentSession } from "@/server/session";
import { RoomRow } from "@/components/RoomRow";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [rooms, session] = await Promise.all([
    listActiveRooms(),
    getCurrentSession(),
  ]);

  const activeRoom =
    session && session.roomId && !session.isSuspended
      ? rooms.find((r) => r.id === session.roomId)
      : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-16 pt-12 sm:pt-20">
      <header className="mb-8 sm:mb-10">
        <p className="text-sm font-medium text-harbor-dark">ONE-X-DESTINY Connect</p>
        <h1 className="mt-2 max-w-md font-display text-4xl leading-[1.08] text-ink sm:text-5xl">
          Talk travel with strangers who get it.
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-mist">
          Pick a room, choose a name nobody will trace back to you, and
          you&apos;re in. No account, no profile, nothing to delete later.
        </p>
      </header>

      {/* Active Session Continuity Banner */}
      {activeRoom && session && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              <span>In Active Conversation</span>
            </div>
            <p className="mt-1 truncate text-sm text-ink">
              Chatting in <strong className="font-semibold text-harbor-dark">{activeRoom.name}</strong> as <span className="font-semibold text-harbor-dark">{session.nickname}</span>
            </p>
          </div>
          <Link
            href={`/rooms/${activeRoom.slug}`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700"
          >
            <span>Return</span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </Link>
        </div>
      )}

      {rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-mist">
          No rooms are open right now. Check back shortly.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              isActive={activeRoom?.id === room.id}
            />
          ))}
        </ul>
      )}

      <p className="mt-12 text-xs leading-relaxed text-mist">
        Rooms are public and shared with everyone who joins. Don&apos;t post
        anything you wouldn&apos;t want a stranger to read — see our{" "}
        <a href="/privacy" className="underline underline-offset-2 hover:text-harbor-dark">
          privacy &amp; safety notes
        </a>
        .
      </p>
    </main>
  );
}
