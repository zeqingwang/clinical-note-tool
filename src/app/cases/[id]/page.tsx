"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { CaseDetail, SourceDocument } from "@/types/case";

export default function CaseEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";

  const [doc, setDoc] = useState<CaseDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [deletingSourceIndex, setDeletingSourceIndex] = useState<number | null>(null);
  const [sourceDeleteError, setSourceDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoadError("Invalid case");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      const res = await fetch(`/api/cases/${id}`);
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.status === 404 ? "Case not found" : `Could not load (${res.status})`);
        setDoc(null);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as CaseDetail;
      if (cancelled) return;
      setDoc(data);
      setTitle(data.title);
      setContent(data.content);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);

      const res = await fetch(`/api/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }

      const refreshed = await fetch(`/api/cases/${id}`);
      if (refreshed.ok) {
        const data = (await refreshed.json()) as CaseDetail;
        setDoc(data);
        setTitle(data.title);
        setContent(data.content);
      }

      startTransition(() => {
        router.refresh();
      });
    },
    [content, id, router, title],
  );

  const onFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !id) return;

      setIngestError(null);
      setIngesting(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/cases/${id}/ingest`, {
          method: "POST",
          body: fd,
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          sourceDocuments?: SourceDocument[];
          titleApplied?: boolean;
        };

        if (!res.ok) {
          setIngestError(payload.error ?? `Upload failed (${res.status})`);
          return;
        }

        const refreshed = await fetch(`/api/cases/${id}`);
        if (refreshed.ok) {
          const data = (await refreshed.json()) as CaseDetail;
          setDoc(data);
          setTitle(data.title);
          setContent(data.content);
        }

        startTransition(() => router.refresh());
      } finally {
        setIngesting(false);
      }
    },
    [id, router],
  );

  const onDeleteSource = useCallback(
    async (index: number, label: string) => {
      if (!id) return;
      if (!confirm(`Remove “${label}” from this case? This removes the structured output only.`)) {
        return;
      }
      setSourceDeleteError(null);
      setDeletingSourceIndex(index);
      try {
        const res = await fetch(`/api/cases/${id}/source-documents/${index}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setSourceDeleteError(data.error ?? `Delete failed (${res.status})`);
          return;
        }
        const refreshed = await fetch(`/api/cases/${id}`);
        if (refreshed.ok) {
          const data = (await refreshed.json()) as CaseDetail;
          setDoc(data);
          setTitle(data.title);
          setContent(data.content);
        }
        startTransition(() => router.refresh());
      } finally {
        setDeletingSourceIndex(null);
      }
    },
    [id, router],
  );

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-6 py-12 text-foreground">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-6 py-12 text-foreground">
        <Link
          href="/cases"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Cases
        </Link>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{loadError ?? "Case not found"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-6 py-12 text-foreground">
      <div className="flex items-center gap-4">
        <Link
          href="/cases"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Cases
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Edit case</h1>

      <section
        aria-labelledby="upload-heading"
        className="flex flex-col gap-4 rounded-xl border-2 border-dashed border-zinc-400 bg-zinc-50 p-6 dark:border-zinc-500 dark:bg-zinc-900/50"
      >
        <div>
          <h2 id="upload-heading" className="text-lg font-semibold text-foreground">
            Upload clinical note
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Choose a <strong>PDF</strong> or <strong>Word document (.docx)</strong>. Text is extracted,
            then structured with the OpenAI API. Requires{" "}
            <code className="rounded bg-zinc-200/90 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
              OPENAI_API_KEY
            </code>{" "}
            in your environment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="case-note-file"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={ingesting}
            onChange={onFileSelected}
            className="sr-only"
          />
          <label
            htmlFor="case-note-file"
            className={`inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90 ${
              ingesting ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {ingesting ? "Working…" : "Choose PDF or Word file…"}
          </label>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">.pdf or .docx only.</span>
        </div>
        {ingesting ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Extracting text and structuring with GPT…</p>
        ) : null}
        {ingestError ? (
          <p className="text-sm text-red-700 dark:text-red-300">{ingestError}</p>
        ) : null}
      </section>

      {doc.sourceDocuments.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Structured output (by file)</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Raw uploads are not stored—only the parsed JSON below is saved on each case.
          </p>
          {sourceDeleteError ? (
            <p className="text-sm text-red-700 dark:text-red-300">{sourceDeleteError}</p>
          ) : null}
          {doc.sourceDocuments.map((sd, index) => (
            <details
              key={`${sd.fileName ?? "doc"}-${index}`}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800"
              open={index === doc.sourceDocuments.length - 1}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  {sd.fileName ?? `Document ${index + 1}`}{" "}
                  <span className="font-normal text-zinc-500">({sd.type})</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void onDeleteSource(
                      index,
                      sd.fileName ?? `Document ${index + 1}`,
                    );
                  }}
                  disabled={deletingSourceIndex !== null}
                  className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  {deletingSourceIndex === index ? "…" : "Delete"}
                </button>
              </summary>
              <pre className="max-h-[28rem] overflow-auto border-t border-zinc-200 px-4 py-3 text-xs leading-relaxed dark:border-zinc-800">
                {JSON.stringify(sd.structuredOutput, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      ) : null}

      <form
        key={`${doc.id}-${doc.updatedAt.toString()}`}
        onSubmit={onSubmit}
        className="flex flex-col gap-6"
      >
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Case title"
            className="rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-700 dark:focus:border-zinc-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="content" className="text-sm font-medium">
            Notes
          </label>
          <textarea
            id="content"
            name="content"
            rows={14}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Clinical notes…"
            className="resize-y rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-700 dark:focus:border-zinc-500"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
