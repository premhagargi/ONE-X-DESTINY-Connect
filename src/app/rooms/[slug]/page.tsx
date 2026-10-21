import { notFound } from "next/navigation";
import { getRoomBySlug } from "@/server/rooms";
import { getCurrentSession } from "@/server/session";
import { getHistoryPage } from "@/server/messages";
import { NicknameGate } from "@/components/NicknameGate";
import { ChatRoom } from "@/components/ChatRoom";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);

  if (!room || !room.isActive) {
    notFound();
  }

  const session = await getCurrentSession();
  const joined = !!session && session.roomId === room.id && !session.isSuspended;

  if (!joined) {
    return (
      <main className="flex flex-1 flex-col">
        <NicknameGate
          roomSlug={room.slug}
          roomName={room.name}
          suspended={!!session?.isSuspended}
        />
      </main>
    );
  }

  const history = await getHistoryPage(room.id, null);

  return (
    <ChatRoom
      room={{ slug: room.slug, name: room.name, description: room.description }}
      nickname={session.nickname}
      initialHistory={history}
    />
  );
}
