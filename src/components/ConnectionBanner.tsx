import type { ConnectionStatus } from "@/hooks/useRealtimeMessages";

export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === "online") return null;

  return (
    <div
      role="status"
      className="border-b border-compass/30 bg-compass-tint px-4 py-1.5 text-center text-xs font-medium text-compass-dark"
    >
      {status === "connecting" ? "Connecting…" : "Reconnecting — your messages are safe and will send once you're back online."}
    </div>
  );
}
