import { notFound } from "next/navigation";
import { getRoomBySlug } from "@/server/rooms";
import { getCurrentSession, ensureRoomMembership } from "@/server/session";
import { getHistoryPage } from "@/server/messages";
import { NicknameGate } from "@/components/NicknameGate";
import { ChatRoom } from "@/components/ChatRoom";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ change?: string }>;
}) {
  const { slug } = await params;
  const { change } = (await searchParams) ?? {};
  const room = await getRoomBySlug(slug);

  if (!room || !room.isActive) {
    notFound();
  }

  const session = await getCurrentSession();

  // If user explicitly clicked to change their nickname, show the gate
  if (change === "1" && session && !session.isSuspended) {
    return (
      <main className="flex flex-1 flex-col">
        <NicknameGate
          roomSlug={room.slug}
          roomName={room.name}
          defaultNickname={session.nickname}
          suspended={false}
        />
      </main>
    );
  }

  // If user has no active session or is suspended, show gate
  if (!session || session.isSuspended) {
    return (
      <main className="flex flex-1 flex-col">
        <NicknameGate
          roomSlug={room.slug}
          roomName={room.name}
          defaultNickname={session?.nickname}
          suspended={!!session?.isSuspended}
        />
      </main>
    );
  }

  // User has an active, valid session! Ensure membership in this room seamlessly
  const membership = await ensureRoomMembership(session, room.id);

  if (!membership.ok) {
    // In the rare event that someone in this room already took this nickname,
    // present NicknameGate with explanatory message
    return (
      <main className="flex flex-1 flex-col">
        <NicknameGate
          roomSlug={room.slug}
          roomName={room.name}
          defaultNickname={session.nickname}
          takenInRoom={true}
          suspended={false}
        />
      </main>
    );
  }

  const history = await getHistoryPage(room.id, null);

  return (
    <ChatRoom
      room={{ slug: room.slug, name: room.name, description: room.description }}
      nickname={membership.session.nickname}
      initialHistory={history}
    />
  );
}
