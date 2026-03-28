"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { CaseDetail } from "@/types/case";

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
