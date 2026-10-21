import Link from "next/link";
import type { Room } from "@prisma/client";

const ROOM_ICONS: Record<string, string> = {
  "solo-travel": "🎒",
  "weekend-getaways": "🚗",
  "budget-travel": "💰",
  "hidden-gems-india": "💎",
  "backpacking": "⛺",
  "travel-questions": "🧭",
};

/**
 * A single room, laid out like a ticket stub: name + description on the
 * left, then the join action on the right. Deliberately not a rounded,
 * shadowed SaaS card — see the design notes in README.md.
 */
export function RoomRow({ room }: { room: Room }) {
  const icon = ROOM_ICONS[room.slug] || "🌍";

  return (
    <li>
      <Link
        href={`/rooms/${room.slug}`}
        className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-line bg-card px-5 py-4 transition-all hover:border-harbor hover:shadow-sm sm:px-6 sm:py-5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-horizon-50 text-xl border border-line/60 group-hover:scale-105 transition-transform">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-xl text-ink sm:text-2xl">
            {room.name}
          </span>
          <span className="mt-1 block line-clamp-1 text-sm text-mist sm:text-base">
            {room.description}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-harbor-tint px-4 py-2 text-sm font-medium text-harbor-dark transition-colors group-hover:bg-harbor group-hover:text-white">
          Join
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            className="shrink-0 transition-transform group-hover:translate-x-0.5"
          >
            <path
              d="M2 7h10M8 3l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>
    </li>
  );
}
