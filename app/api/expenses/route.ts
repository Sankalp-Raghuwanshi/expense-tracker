/**
 * POST /api/expenses — Create a new expense (idempotent)
 * GET  /api/expenses — List expenses with optional filter & sort
 *
 * Design decisions:
 * - Amount is received in cents (integer) from the client. The frontend is
 *   responsible for converting dollars → cents before sending.
 * - Idempotency: The client sends a unique `idempotencyKey` with each
 *   submission. If a retry hits the UNIQUE constraint on that key, we catch
 *   the Prisma error (code P2002) and return the existing record, making
 *   the operation safe to retry without creating duplicates.
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma";

// Force dynamic rendering — this route reads/writes a database.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST — create expense
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { amount, category, description, date, idempotencyKey } = body as {
    amount: unknown;
    category: unknown;
    description: unknown;
    date: unknown;
    idempotencyKey: unknown;
  };

  // --- Validation -----------------------------------------------------------
  const errors: string[] = [];

  if (typeof idempotencyKey !== "string" || idempotencyKey.trim() === "") {
    errors.push("idempotencyKey is required (string).");
  }

  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    errors.push("amount must be a positive integer (cents).");
  }

  if (typeof category !== "string" || category.trim() === "") {
    errors.push("category is required.");
  }

  if (typeof description !== "string" || description.trim() === "") {
    errors.push("description is required.");
  }

  const parsedDate = typeof date === "string" ? new Date(date) : null;
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    errors.push("date must be a valid ISO 8601 string.");
  }

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  // --- Create (with idempotency) --------------------------------------------
  try {
    const expense = await prisma.expense.create({
      data: {
        idempotencyKey: (idempotencyKey as string).trim(),
        amount: amount as number,
        category: (category as string).trim(),
        description: (description as string).trim(),
        date: parsedDate!,
      },
    });

    return Response.json(expense, { status: 201 });
  } catch (error) {
    // P2002 = unique constraint violation. If the idempotencyKey already
    // exists, the client is retrying — return the existing record.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.expense.findUnique({
        where: { idempotencyKey: (idempotencyKey as string).trim() },
      });

      if (existing) {
        return Response.json(existing, { status: 200 });
      }
    }

    console.error("POST /api/expenses error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — list expenses
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const category = searchParams.get("category");
  const sort = searchParams.get("sort");

  try {
    const expenses = await prisma.expense.findMany({
      where: category ? { category } : undefined,
      orderBy:
        sort === "date_desc"
          ? { date: "desc" }
          : sort === "date_asc"
            ? { date: "asc" }
            : { createdAt: "desc" }, // default: newest-created first
    });

    return Response.json(expenses);
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
