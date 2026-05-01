# Personal Finance Expense Tracker

A minimal, full-stack expense tracking application built with a focus on **data correctness**, **API resilience**, and **clean code**.

## Tech Stack

| Layer     | Technology            | Why                                                                                                      |
| --------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| Framework | Next.js (App Router)  | Full-stack React framework — API routes and UI in one project, server components, great DX.               |
| Language  | TypeScript            | Catches bugs at compile time, self-documenting types.                                                    |
| Database  | SQLite via Prisma ORM | Zero-config local database. Prisma provides type-safe queries and migrations.                            |
| Styling   | Tailwind CSS v4       | Utility-first CSS with zero runtime cost. v4 uses `@theme inline` blocks instead of a config file.       |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Generate the Prisma client
npx prisma generate

# 3. Run the database migration (creates dev.db)
npx prisma migrate dev --name init

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Design Decisions

### Money as Integer Cents

All monetary amounts are stored as **integers representing cents** (e.g., `$12.50` → `1250`). This avoids IEEE 754 floating-point rounding errors that plague decimal arithmetic in JavaScript. Conversion happens only at the UI boundary:

- **Frontend → API**: `Math.round(parseFloat(input) * 100)`
- **API → Frontend**: `(cents / 100).toFixed(2)`

### Idempotent Expense Creation

Network unreliability can cause a client to retry a POST request even though the server already processed it. To prevent duplicate expenses:

1. The client generates a UUID (`crypto.randomUUID()`) as an **idempotency key** for each form submission.
2. The key is sent in the request body and stored in a `UNIQUE` column on the `Expense` table.
3. If a retry hits the unique constraint (`Prisma P2002` error), the server catches it, looks up the existing record, and returns it with HTTP 200.
4. The client only generates a **new** key after a successful submission. On failure, it retries with the same key.

### Double-Submit Protection

The submit button is disabled and shows a spinner while the request is in-flight. This prevents accidental double-clicks from firing multiple requests.

### Dark / Light Mode

The app supports a manual theme toggle (sun/moon button in the header). The user's preference is persisted in `localStorage` and defaults to the system preference (`prefers-color-scheme`) on first visit. Theme switching is implemented via a `.dark` class on `<html>` that swaps CSS custom properties.

## API Reference

### `POST /api/expenses`

Create a new expense.

**Request body:**

```json
{
  "amount": 1250,
  "category": "Food & Dining",
  "description": "Lunch at cafe",
  "date": "2025-01-15T00:00:00.000Z",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `amount` — positive integer, in cents
- `idempotencyKey` — UUID string, unique per submission

**Response:** `201 Created` (or `200 OK` if idempotency key already exists)

### `GET /api/expenses`

List expenses.

**Query parameters:**

| Param      | Type   | Description                                |
| ---------- | ------ | ------------------------------------------ |
| `category` | string | Exact-match filter on category             |
| `sort`     | string | `date_desc` (newest first) or `date_asc`   |

## Project Structure

```
app/
├── api/expenses/route.ts   # API route handlers (POST + GET)
├── components/
│   ├── ExpenseTracker.tsx   # Main client component (form, list, filters)
│   └── ThemeProvider.tsx    # Dark/light mode context + toggle button
├── generated/prisma/       # Auto-generated Prisma client (git-ignored)
├── globals.css             # Tailwind v4 theme tokens (light + dark)
├── layout.tsx              # Root layout with SEO metadata + ThemeProvider
└── page.tsx                # Server component shell
lib/
└── db.ts                   # Prisma client singleton (better-sqlite3 adapter)
prisma/
├── schema.prisma           # Data model
└── migrations/             # SQLite migration history
```

## Trade-offs & Intentional Omissions

These were left out to keep scope minimal and focus on the core requirements:

- **No authentication** — this is a single-user local tool.
- **No edit/delete** — only create and read operations are implemented.
- **No pagination** — all expenses are fetched at once. Fine for personal use; would need cursor-based pagination at scale.
- **No server-side currency formatting** — the frontend formats dollars with `.toFixed(2)`. A production app would use `Intl.NumberFormat` with locale support.
- **No end-to-end tests** — manual verification was used. A production app would add Playwright or Cypress tests.
- **SQLite** — great for local dev, but would need PostgreSQL/MySQL for production multi-user deployments.
