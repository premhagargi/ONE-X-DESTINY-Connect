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
 * left, then the join/active action on the right.
 */
export function RoomRow({ room, isActive = false }: { room: Room; isActive?: boolean }) {
  const icon = ROOM_ICONS[room.slug] || "🌍";

  return (
    <li>
      <Link
        href={`/rooms/${room.slug}`}
        className={`group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border px-5 py-4 transition-all sm:px-6 sm:py-5 ${
          isActive
            ? "border-emerald-500/50 bg-card shadow-xs hover:border-emerald-600"
            : "border-line bg-card hover:border-harbor hover:shadow-sm"
        }`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-horizon-50 text-xl border border-line/60 group-hover:scale-105 transition-transform">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-xl text-ink sm:text-2xl">
              {room.name}
            </span>
            {isActive && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Active
              </span>
            )}
          </span>
          <span className="mt-1 block line-clamp-1 text-sm text-mist sm:text-base">
            {room.description}
          </span>
        </span>
        <span
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            isActive
              ? "bg-emerald-600 text-white group-hover:bg-emerald-700"
              : "bg-harbor-tint text-harbor-dark group-hover:bg-harbor group-hover:text-white"
          }`}
        >
          {isActive ? "Continue" : "Join"}
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
