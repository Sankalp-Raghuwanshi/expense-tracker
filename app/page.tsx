import ExpenseTracker from "@/app/components/ExpenseTracker";

/**
 * Home page — a thin server component wrapper.
 * The actual UI lives in ExpenseTracker (a client component) because it
 * needs interactivity (form state, fetch, event handlers).
 */
export default function Home() {
  return (
    <main className="flex flex-col flex-1">
      <ExpenseTracker />
    </main>
  );
}
