import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * A single, reused PrismaClient instance per server process.
 *
 * Next.js reloads modules on every request in dev (and the Next.js dev
 * server itself hot-reloads), which would otherwise create a fresh
 * PrismaClient — and a fresh connection pool — on every file save. We cache
 * the instance on `globalThis` in development and across warm serverless
 * invocations to avoid exhausting the database's connection limit.
 *
 * Connection string: DATABASE_URL should be Supabase's pooled
 * ("Transaction pooler", port 6543, `?pgbouncer=true`) connection string.
 * Prisma Migrate / `db push` use DIRECT_URL (port 5432) instead — see
 * prisma/schema.prisma and the README.
 */

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:placeholder@127.0.0.1:5432/postgres";

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

// Maintain cached client on globalThis in both development and serverless containers
// to prevent connection pool churn across warm lambdas.
globalThis.__prisma = prisma;
