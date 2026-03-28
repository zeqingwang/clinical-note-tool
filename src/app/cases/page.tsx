import Link from "next/link";
import { listCases } from "@/lib/cases-db";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const cases = await listCases();

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-6 py-12 text-foreground">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Clinical cases stored in MongoDB. Open a case to upload a{" "}
            <strong>PDF</strong> or <strong>Word (.docx)</strong> note for AI structuring.
          </p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:opacity-90"
        >
          New case
        </Link>
      </header>

      {cases.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-10 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No cases yet. Create one with <strong>New case</strong>.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="flex flex-col gap-0.5 px-4 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium">{c.title}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Updated {c.updatedAt.toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
