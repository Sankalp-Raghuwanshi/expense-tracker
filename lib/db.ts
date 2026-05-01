/**
 * Prisma Client Singleton
 *
 * Prisma Postgres (Vercel integration) uses Prisma Accelerate, which
 * requires `accelerateUrl` instead of a driver adapter.
 */
import { PrismaClient } from "@/app/generated/prisma";
import { withAccelerate } from "@prisma/extension-accelerate"; // <-- CRITICAL: You must import the extension

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined; // <-- Updated type to handle the extension
};

function createPrismaClient() {
  // In Prisma 6, the `url` property in schema.prisma handles the connection string.
  // The withAccelerate extension automatically uses it.
  return new PrismaClient().$extends(withAccelerate());
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}