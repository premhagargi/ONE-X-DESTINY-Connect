import { listActiveRooms } from "@/server/rooms";
import { RoomRow } from "@/components/RoomRow";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rooms = await listActiveRooms();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-16 pt-12 sm:pt-20">
      <header className="mb-10 sm:mb-14">
        <p className="text-sm font-medium text-harbor-dark">ONE-X-DESTINY Connect</p>
        <h1 className="mt-2 max-w-md font-display text-4xl leading-[1.08] text-ink sm:text-5xl">
          Talk travel with strangers who get it.
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-mist">
          Pick a room, choose a name nobody will trace back to you, and
          you&apos;re in. No account, no profile, nothing to delete later.
        </p>
      </header>

      {rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-mist">
          No rooms are open right now. Check back shortly.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} />
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
