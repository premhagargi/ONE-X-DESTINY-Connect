export default function RoomLoading() {
  return (
    <div className="flex h-dvh flex-1 flex-col bg-horizon">
      {/* Header Skeleton */}
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
        <div className="h-9 w-9 shrink-0 rounded-full bg-horizon-50 animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-36 rounded-md bg-horizon-50 animate-pulse" />
          <div className="h-3.5 w-60 rounded-md bg-horizon-50/60 animate-pulse" />
        </div>
        <div className="h-8 w-20 rounded-full bg-horizon-50 animate-pulse" />
      </header>

      {/* Message List Skeleton */}
      <div className="flex-1 overflow-y-auto px-3 py-6 sm:px-6 space-y-5">
        {/* Message 1 */}
        <div className="flex gap-3 px-3 py-1.5 animate-pulse">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-line/50" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 rounded bg-line/60" />
              <div className="h-3 w-12 rounded bg-line/40" />
            </div>
            <div className="h-4 w-3/4 rounded bg-line/40" />
            <div className="h-4 w-1/2 rounded bg-line/30" />
          </div>
        </div>

        {/* Message 2 (consecutive) */}
        <div className="flex gap-3 px-3 py-1 animate-pulse">
          <div className="w-9 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-line/40" />
          </div>
        </div>

        {/* Message 3 */}
        <div className="flex gap-3 px-3 py-1.5 animate-pulse">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-line/50" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-28 rounded bg-line/60" />
              <div className="h-3 w-12 rounded bg-line/40" />
            </div>
            <div className="h-4 w-4/5 rounded bg-line/40" />
          </div>
        </div>

        {/* Message 4 */}
        <div className="flex gap-3 px-3 py-1.5 animate-pulse">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-line/50" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 rounded bg-line/60" />
              <div className="h-3 w-12 rounded bg-line/40" />
            </div>
            <div className="h-4 w-3/5 rounded bg-line/40" />
          </div>
        </div>
      </div>

      {/* Composer Skeleton */}
      <div className="border-t border-line bg-card px-3 py-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex flex-col rounded-2xl border border-line bg-horizon-50/40 p-3 space-y-3 animate-pulse">
          <div className="h-6 w-1/3 rounded bg-line/40" />
          <div className="flex items-center justify-between border-t border-line/30 pt-2">
            <div className="flex gap-1.5">
              <div className="h-7 w-7 rounded-lg bg-line/40" />
              <div className="h-7 w-7 rounded-lg bg-line/40" />
              <div className="h-7 w-7 rounded-lg bg-line/40" />
            </div>
            <div className="h-7 w-16 rounded-lg bg-line/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
