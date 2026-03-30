"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CaseRow = {
  id: string;
  title: string;
  updatedAt: string;
};

export default function CasesPage() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/cases");
    if (!res.ok) {
      setLoadError(`Could not load cases (${res.status})`);
      setCases([]);
      return;
    }
    const data = (await res.json()) as CaseRow[];
    setCases(data);
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const handleDelete = useCallback(
    async (caseId: string) => {
      if (!confirm("Delete this case? This cannot be undone.")) {
        return;
      }
      setDeletingId(caseId);
      try {
        const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
        if (!res.ok) {
          alert("Could not delete the case.");
          return;
        }
        await loadCases();
      } finally {
        setDeletingId(null);
      }
    },
    [loadCases],
  );

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
        <div className="flex flex-wrap gap-2">
          <Link
            href="/mcg"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            MCG criteria
          </Link>
          <Link
            href="/cases/new"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:opacity-90"
          >
            New case
          </Link>
        </div>
      </header>

      {cases === null ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      ) : loadError ? (
        <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
      ) : cases.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-10 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No cases yet. Create one with <strong>New case</strong>.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {cases.map((c) => (
            <li key={c.id}>
              <div className="flex items-center gap-3 px-4 py-3 sm:gap-4">
                <Link
                  href={`/cases/${c.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 py-1 transition-colors hover:opacity-80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="truncate font-medium">{c.title}</span>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    Updated {new Date(c.updatedAt).toLocaleString()}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleDelete(c.id);
                  }}
                  disabled={deletingId === c.id}
                  className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  {deletingId === c.id ? "…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
