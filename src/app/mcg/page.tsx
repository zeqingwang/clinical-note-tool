"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type McgRow = {
  id: string;
  title: string;
  sourceFileName: string;
  updatedAt: string;
  diseaseKeys: string[];
};

export default function McgListPage() {
  const [rows, setRows] = useState<McgRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/mcg", { cache: "no-store" });
    if (!res.ok) {
      setLoadError(`Could not load MCG documents (${res.status})`);
      setRows([]);
      return;
    }
    const data = (await res.json()) as McgRow[];
    setRows(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setIngestError(null);
      setIngesting(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/mcg/ingest", { method: "POST", body: fd });
        const bodyText = await res.text();
        let data = {} as { id?: string; error?: string };
        try {
          data = JSON.parse(bodyText) as { id?: string; error?: string };
        } catch {
          // Non-JSON response body (common for 500 HTML error pages)
          data = {};
        }
        if (!res.ok) {
          // Helps diagnose Amplify 500s by showing the server error in console.
          console.error("MCG upload failed", {
            status: res.status,
            error: data.error,
            responseText: bodyText,
            response: data,
          });
          setIngestError(data.error ?? `Upload failed (${res.status})`);
          return;
        }
        if (typeof data.id === "string") {
          await load();
          window.location.href = `/mcg/${data.id}`;
        }
      } catch (e) {
        console.error("MCG upload request threw", e);
        setIngestError("Upload request failed");
      } finally {
        setIngesting(false);
      }
    },
    [load],
  );

  const handleDelete = useCallback(
    async (mcgId: string) => {
      if (!confirm("Delete this MCG document? This cannot be undone.")) return;
      setDeletingId(mcgId);
      try {
        const res = await fetch(`/api/mcg/${mcgId}`, { method: "DELETE" });
        if (!res.ok) {
          alert("Could not delete.");
          return;
        }
        await load();
      } finally {
        setDeletingId(null);
      }
    },
    [load],
  );

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-6 py-12 text-foreground">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MCG criteria</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload a PDF or Word (.docx) guideline. Each disease or pathway becomes a structured map:
            diagnosis thresholds, inpatient indicators, and risk factors. Separate from clinical cases.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800">
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={(ev) => void onFile(ev)}
              disabled={ingesting}
            />
            {ingesting ? "Processing…" : "Upload document"}
          </label>
          <Link
            href="/cases"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            Cases
          </Link>
        </div>
      </header>

      {ingestError ? (
        <p className="text-sm text-red-700 dark:text-red-300">{ingestError}</p>
      ) : null}

      {rows === null ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      ) : loadError ? (
        <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-10 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No MCG documents yet. Use Upload document with a guideline PDF or DOCX.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <Link href={`/mcg/${r.id}`} className="font-medium text-foreground hover:underline">
                  {r.title}
                </Link>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {r.sourceFileName} · {r.diseaseKeys.length} disease block(s):{" "}
                  {r.diseaseKeys.length ? r.diseaseKeys.join(", ") : "—"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  Updated {new Date(r.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/mcg/${r.id}`}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-900"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDelete(r.id)}
                  disabled={deletingId !== null}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300"
                >
                  {deletingId === r.id ? "…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
