/**
 * Prisma Client Singleton
 *
 * Prisma Postgres (Vercel integration) uses Prisma Accelerate, which
 * requires `accelerateUrl` instead of a driver adapter.
 *
 * The DATABASE_URL will look like:
 *   prisma://accelerate.prisma-data.net/?api_key=...
 *
 * The singleton pattern prevents connection pool exhaustion during
 * Next.js hot-reloads in development.
 */
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Prisma Postgres connection string to .env"
    );
  }
  return new PrismaClient({ accelerateUrl: url });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
