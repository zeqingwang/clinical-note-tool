"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { MCGCriteria } from "@/models/mcg";

type ApiMcg = {
  id: string;
  title: string;
  sourceFileName: string;
  updatedAt: string;
  diseaseKeys: string[];
  criteria: MCGCriteria;
};

function formatCriterionValue(v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export default function McgDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";

  const [doc, setDoc] = useState<ApiMcg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError("Invalid id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      const res = await fetch(`/api/mcg/${id}`, { cache: "no-store" });
      if (cancelled) return;
      if (!res.ok) {
        setError(res.status === 404 ? "Not found" : `Could not load (${res.status})`);
        setDoc(null);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as ApiMcg;
      if (cancelled) return;
      setDoc(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-zinc-600 dark:text-zinc-400">
        Loading…
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-red-700 dark:text-red-300">{error ?? "Missing document"}</p>
        <Link href="/mcg" className="mt-4 inline-block text-sm text-foreground underline">
          Back to MCG
        </Link>
      </div>
    );
  }

  const entries = Object.entries(doc.criteria);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12 text-foreground">
      <header>
        <Link href="/mcg" className="text-sm text-zinc-600 hover:text-foreground dark:text-zinc-400">
          ← MCG list
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Source: {doc.sourceFileName} · Updated {new Date(doc.updatedAt).toLocaleString()}
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Structured map: each key is a disease or pathway id; values match the app&apos;s MCG-shaped
          schema (diagnosisCriteria, inpatientIndicators, riskFactors).
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {entries.map(([diseaseId, block]) => (
          <section
            key={diseaseId}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40"
          >
            <h2 className="font-mono text-lg font-semibold text-foreground">{diseaseId}</h2>

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Diagnosis criteria
              </h3>
              {Object.keys(block.diagnosisCriteria).length === 0 ? (
                <p className="mt-1 text-sm italic text-zinc-400">None extracted</p>
              ) : (
                <dl className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {Object.entries(block.diagnosisCriteria).map(([k, v]) => (
                    <div key={k} className="grid gap-1 py-2 sm:grid-cols-[1fr_2fr]">
                      <dt className="font-mono text-sm text-zinc-600 dark:text-zinc-400">{k}</dt>
                      <dd className="text-sm text-foreground">{formatCriterionValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Inpatient indicators
              </h3>
              {block.inpatientIndicators.length === 0 ? (
                <p className="mt-1 text-sm italic text-zinc-400">None extracted</p>
              ) : (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground">
                  {block.inpatientIndicators.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Risk factors
              </h3>
              {block.riskFactors.length === 0 ? (
                <p className="mt-1 text-sm italic text-zinc-400">None extracted</p>
              ) : (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground">
                  {block.riskFactors.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Raw JSON (criteria map)
        </summary>
        <pre className="max-h-[480px] overflow-auto border-t border-zinc-200 p-4 text-xs leading-relaxed dark:border-zinc-800">
          {JSON.stringify(doc.criteria, null, 2)}
        </pre>
      </details>
    </div>
  );
}
