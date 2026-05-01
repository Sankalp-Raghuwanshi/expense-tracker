"use client";

/**
 * ExpenseTracker — the main client component.
 *
 * Responsibilities:
 * 1. Fetching and displaying the expense list from GET /api/expenses
 * 2. Submitting new expenses via POST /api/expenses (with idempotency)
 * 3. Filtering by category and sorting by date
 * 4. Showing a dynamic summary (total) of visible expenses
 * 5. Handling loading states, errors, and double-submit protection
 *
 * Money handling:
 * - The user enters dollars (e.g., "12.50").
 * - We convert to cents (integer) before sending to the API: 12.50 → 1250.
 * - The API stores and returns cents. We convert back to dollars for display.
 * - This avoids floating-point rounding issues in all arithmetic.
 */

import { useState, useEffect, useCallback, FormEvent } from "react";
import { ThemeToggle } from "@/app/components/ThemeProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Expense {
  id: string;
  idempotencyKey: string;
  amount: number; // in cents
  category: string;
  description: string;
  date: string;
  createdAt: string;
}

// Default categories for the dropdown. Could be fetched from the DB later.
const CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Housing",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "Shopping",
  "Education",
  "Travel",
  "Other",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a dollar string to cents. Returns null if invalid. */
function dollarsToCents(dollars: string): number | null {
  // Strip leading/trailing whitespace and dollar signs
  const cleaned = dollars.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  // Round to avoid floating-point artifacts: 12.50 * 100 = 1249.9999... → 1250
  return Math.round(num * 100);
}

/** Format cents as a dollar string for display. */
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Generate a UUID v4 for idempotency keys. */
function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExpenseTracker() {
  // --- State ----------------------------------------------------------------
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form fields
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [sortOrder, setSortOrder] = useState<"date_desc" | "date_asc">(
    "date_desc"
  );

  // Idempotency key — regenerated after each successful submission.
  // If the user retries the same submission (e.g., due to network failure),
  // we keep the same key so the server deduplicates.
  const [idempotencyKey, setIdempotencyKey] = useState(generateId);

  // --- Data fetching --------------------------------------------------------

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    params.set("sort", sortOrder);

    try {
      const res = await fetch(`/api/expenses?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      const data: Expense[] = await res.json();
      setExpenses(data);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load expenses"
      );
    } finally {
      setLoading(false);
    }
  }, [filterCategory, sortOrder]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // --- Form submission ------------------------------------------------------

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    // Client-side validation
    const cents = dollarsToCents(amount);
    if (cents === null || cents <= 0) {
      setSubmitError("Enter a valid positive amount (e.g., 12.50).");
      return;
    }
    if (!description.trim()) {
      setSubmitError("Description is required.");
      return;
    }
    if (!date) {
      setSubmitError("Date is required.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cents,
          category,
          description: description.trim(),
          date: new Date(date).toISOString(),
          idempotencyKey,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.errors?.join(", ") || body?.error || `Error ${res.status}`
        );
      }

      // Success — reset form and generate a new idempotency key
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setIdempotencyKey(generateId());
      setSubmitSuccess(true);

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);

      // Refresh the list
      await fetchExpenses();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit expense"
      );
      // Don't regenerate idempotencyKey on failure — the user may retry,
      // and we want the same key to prevent duplicates.
    } finally {
      setSubmitting(false);
    }
  }

  // --- Dynamic summary ------------------------------------------------------

  const totalCents = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Collect unique categories from the current data for the filter dropdown
  const uniqueCategories = Array.from(
    new Set(expenses.map((e) => e.category))
  ).sort();

  // Also build the filter dropdown from all known categories (union of
  // CATEGORIES constant + whatever is in the data)
  const allCategories = Array.from(
    new Set([...CATEGORIES, ...uniqueCategories])
  ).sort();

  // --- Render ---------------------------------------------------------------

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <header className="relative text-center space-y-2">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            💰 Expense Tracker
          </h1>
          <p className="text-muted text-base">
            Record, review, and understand your spending
          </p>
        </header>

        {/* ----------------------------------------------------------------- */}
        {/* Add Expense Form                                                   */}
        {/* ----------------------------------------------------------------- */}
        <section
          className="rounded-xl border border-border bg-surface p-6 shadow-sm"
          aria-labelledby="form-heading"
        >
          <h2 id="form-heading" className="text-lg font-semibold mb-4">
            Add Expense
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Amount */}
              <div className="space-y-1">
                <label
                  htmlFor="expense-amount"
                  className="text-sm font-medium text-muted"
                >
                  Amount ($)
                </label>
                <input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted/50 transition-colors"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label
                  htmlFor="expense-category"
                  className="text-sm font-medium text-muted"
                >
                  Category
                </label>
                <select
                  id="expense-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label
                  htmlFor="expense-description"
                  className="text-sm font-medium text-muted"
                >
                  Description
                </label>
                <input
                  id="expense-description"
                  type="text"
                  placeholder="What did you spend on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted/50 transition-colors"
                />
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label
                  htmlFor="expense-date"
                  className="text-sm font-medium text-muted"
                >
                  Date
                </label>
                <input
                  id="expense-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors"
                />
              </div>
            </div>

            {/* Submit button — disabled while request is in flight */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Saving…
                </span>
              ) : (
                "Add Expense"
              )}
            </button>

            {/* Feedback messages */}
            {submitError && (
              <p
                className="text-sm text-danger font-medium"
                role="alert"
                id="submit-error"
              >
                ⚠️ {submitError}
              </p>
            )}
            {submitSuccess && (
              <p
                className="text-sm text-success font-medium"
                role="status"
                id="submit-success"
              >
                ✅ Expense added successfully!
              </p>
            )}
          </form>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Filters & Summary                                                  */}
        {/* ----------------------------------------------------------------- */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category filter */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="filter-category"
                className="text-sm font-medium text-muted"
              >
                Filter:
              </label>
              <select
                id="filter-category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition-colors"
              >
                <option value="">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort toggle */}
            <button
              id="sort-toggle"
              onClick={() =>
                setSortOrder((prev) =>
                  prev === "date_desc" ? "date_asc" : "date_desc"
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-hover"
            >
              <span>Date</span>
              <span className="text-muted">
                {sortOrder === "date_desc" ? "↓ Newest" : "↑ Oldest"}
              </span>
            </button>
          </div>

          {/* Dynamic total */}
          <div
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm"
            id="expense-summary"
          >
            <span className="text-muted">Total: </span>
            <span className="font-bold text-lg tabular-nums">
              ${centsToDollars(totalCents)}
            </span>
            <span className="text-muted ml-1">
              ({expenses.length} expense{expenses.length !== 1 ? "s" : ""})
            </span>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Expense List                                                       */}
        {/* ----------------------------------------------------------------- */}
        <section
          className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden"
          aria-labelledby="list-heading"
        >
          <h2 id="list-heading" className="sr-only">
            Expense List
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-16" id="loading-spinner">
              <svg
                className="animate-spin h-8 w-8 text-accent"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3" id="fetch-error">
              <p className="text-danger font-medium">⚠️ {fetchError}</p>
              <button
                onClick={fetchExpenses}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Retry
              </button>
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted" id="empty-state">
              <p>No expenses found. Add one above!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" id="expense-table">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-surface-hover"
                    >
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                        {new Date(exp.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        {exp.description}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium tabular-nums">
                        ${centsToDollars(exp.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
