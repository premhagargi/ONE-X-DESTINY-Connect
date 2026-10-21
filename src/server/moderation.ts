import "server-only";
import { prisma } from "@/lib/prisma";

export async function createReport(params: {
  messageId: string;
  sessionId: string;
  reason: string;
}) {
  return prisma.report.create({
    data: {
      messageId: params.messageId,
      sessionId: params.sessionId,
      reason: params.reason,
    },
  });
}

/**
 * Admin-only operations, gated at the route layer by requireAdmin() (see
 * src/server/admin.ts) — never exposed to normal clients. Deliberately
 * tiny surface area per the "no complicated moderation dashboard" guidance:
 * soft-delete a message, and suspend a session.
 */

export async function listOpenReports(limit = 50) {
  return prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      message: { select: { id: true, roomId: true, nickname: true, body: true, createdAt: true } },
    },
  });
}

export async function adminDeleteMessage(messageId: string, reason: string) {
  return prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, deletedReason: reason },
  });
}

export async function adminSuspendSession(sessionId: string, reason: string) {
  return prisma.chatSession.update({
    where: { id: sessionId },
    data: { isSuspended: true, suspendedReason: reason },
  });
}

export async function adminResolveReport(
  reportId: string,
  status: "REVIEWED" | "DISMISSED" | "ACTIONED",
) {
  return prisma.report.update({ where: { id: reportId }, data: { status } });
}
