import "server-only";
import { prisma } from "@/lib/prisma";

export async function listActiveRooms() {
  return prisma.room.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getRoomBySlug(slug: string) {
  return prisma.room.findUnique({ where: { slug } });
}
