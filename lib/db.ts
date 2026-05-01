/**
 * Prisma Client Singleton
 *
 * Prisma Postgres (Vercel integration) uses Prisma Accelerate, which
 * requires `accelerateUrl` instead of a driver adapter.
 */
import { PrismaClient } from "@/app/generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate"; // <-- CRITICAL: You must import the extension

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined; // <-- Updated type to handle the extension
};

function createPrismaClient() {
  // Vercel stores the `prisma://` connection string in PRISMA_DATABASE_URL.
  // DATABASE_URL usually holds the standard `postgres://` string.
  const url = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "Database URL is not set. Add your Prisma Postgres connection string to .env"
    );
  }

  // CRITICAL: You must append .$extends(withAccelerate()) to the client
  return new PrismaClient({ accelerateUrl: url }).$extends(withAccelerate());
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}