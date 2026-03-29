"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { rebuildStructuredRawDataFromDocuments } from "@/lib/structured-raw-data";
import { emptyStructuredRawPersisted, type MergedForHpi } from "@/models/case";
import type { GeneratedHpiEntry, SourceDocument } from "@/types/case";

const PRIMARY_FIELDS: { key: keyof MergedForHpi; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "symptoms", label: "Symptoms" },
  { key: "positives", label: "Positives" },
  { key: "negatives", label: "Negatives" },
  { key: "abnormalLabs", label: "Abnormal labs" },
  { key: "keyExamFindings", label: "Key exam findings" },
  { key: "diagnosisClues", label: "Diagnosis clues" },
  { key: "admissionRationale", label: "Admission rationale" },
];

const SUPPLEMENTARY_FIELDS: { key: keyof MergedForHpi; label: string }[] = [
  { key: "chiefComplaints", label: "Chief complaints (by source)" },
  { key: "hpiNarratives", label: "HPI narratives" },
  { key: "rosCombined", label: "Review of systems" },
  { key: "allergies", label: "Allergies" },
  { key: "medications", label: "Medications" },
  { key: "allLabsMarkdown", label: "All labs" },
  { key: "vitalsMarkdown", label: "Vitals" },
];

function Section({
  label,
  text,
}: {
  label: string;
  text: string | undefined;
}) {
  const trimmed = String(text ?? "").trim();
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </h3>
      {trimmed ? (
        <pre className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm leading-relaxed text-foreground dark:border-zinc-800 dark:bg-zinc-900/40">
          {trimmed}
        </pre>
      ) : (
        <p className="text-sm italic text-zinc-400 dark:text-zinc-500">No data</p>
      )}
    </div>
  );
}

export function MergedHpiSummary({
  caseId,
  merged,
  sourceDocuments,
  generatedHPI,
  onGeneratedHpiChange,
}: {
  caseId?: string;
  merged?: MergedForHpi | null;
  /** When set, summary is recomputed from every file’s structured output (matches server). */
  sourceDocuments?: SourceDocument[];
  generatedHPI: GeneratedHpiEntry[];
  onGeneratedHpiChange?: (entries: GeneratedHpiEntry[]) => void;
}) {
  const m =
    sourceDocuments != null && sourceDocuments.length > 0
      ? rebuildStructuredRawDataFromDocuments(sourceDocuments).mergedForHpi
      : (merged ?? emptyStructuredRawPersisted().mergedForHpi);

  const [hpiLoading, setHpiLoading] = useState(false);
  const [hpiError, setHpiError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const entryKey = useCallback((e: GeneratedHpiEntry) => `${e.createdAt}\n${e.text}`, []);

  const reversedHpi = useMemo(() => [...generatedHPI].reverse(), [generatedHPI]);
  const hpiListLenRef = useRef(0);
  const [openHpiKeys, setOpenHpiKeys] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    const n = reversedHpi.length;
    if (n === 0) {
      setOpenHpiKeys(new Set());
      hpiListLenRef.current = 0;
      return;
    }
    if (n !== hpiListLenRef.current) {
      hpiListLenRef.current = n;
      setOpenHpiKeys(new Set([entryKey(reversedHpi[0])]));
    }
  }, [reversedHpi, entryKey]);

  const onDeleteHpiEntry = useCallback(
    async (entry: GeneratedHpiEntry) => {
      if (!caseId?.trim()) return;
      setDeleteError(null);
      const key = entryKey(entry);
      setDeletingKey(key);
      try {
        const res = await fetch(`/api/cases/${caseId}/generated-hpi`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ createdAt: entry.createdAt, text: entry.text }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          generatedHPI?: GeneratedHpiEntry[];
          error?: string;
        };
        if (!res.ok) {
          setDeleteError(data.error ?? `Delete failed (${res.status})`);
          return;
        }
        if (Array.isArray(data.generatedHPI)) {
          onGeneratedHpiChange?.(data.generatedHPI);
        }
      } catch {
        setDeleteError("Delete request failed");
      } finally {
        setDeletingKey(null);
      }
    },
    [caseId, entryKey, onGeneratedHpiChange],
  );

  const onGenerateHpi = useCallback(async () => {
    if (!caseId?.trim()) return;
    setHpiError(null);
    setHpiLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/generate-hpi`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        hpi?: string;
        generatedHPI?: GeneratedHpiEntry[];
        error?: string;
      };
      if (!res.ok) {
        setHpiError(data.error ?? `Generation failed (${res.status})`);
        return;
      }
      if (typeof data.hpi === "string" && data.hpi.trim()) {
        if (Array.isArray(data.generatedHPI)) {
          onGeneratedHpiChange?.(data.generatedHPI);
        }
      } else {
        setHpiError("Empty response");
      }
    } catch {
      setHpiError("Request failed");
    } finally {
      setHpiLoading(false);
    }
  }, [caseId, onGeneratedHpiChange]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 id="merged-hpi-heading" className="text-lg font-semibold tracking-tight">
          Summarized clinical layer
        </h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Normalized merge across uploaded files for HPI generation. Each section lists all current
          sources ({sourceDocuments?.length ?? 0}).
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void onGenerateHpi()}
            disabled={hpiLoading || !caseId?.trim()}
            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {hpiLoading ? "Generating…" : "Generate HPI"}
          </button>
        </div>
        {hpiError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{hpiError}</p>
        ) : null}
        {deleteError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{deleteError}</p>
        ) : null}
        {generatedHPI.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Generated HPI (history)
            </h3>
            {reversedHpi.map((entry) => {
              const k = entryKey(entry);
              const isOpen = openHpiKeys.has(k);
              return (
                <details
                  key={k}
                  className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/50"
                  open={isOpen}
                  onToggle={(e) => {
                    const el = e.currentTarget;
                    setOpenHpiKeys((prev) => {
                      const next = new Set(prev);
                      if (el.open) next.add(k);
                      else next.delete(k);
                      return next;
                    });
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                    <svg
                      className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="min-w-0 flex-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void onDeleteHpiEntry(entry);
                      }}
                      disabled={deletingKey !== null}
                      className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      {deletingKey === k ? "…" : "Delete"}
                    </button>
                  </summary>
                  <div className="border-t border-zinc-200 px-3 py-3 text-sm leading-relaxed text-foreground dark:border-zinc-800">
                    {entry.text.split("\n\n").map((para, j) => (
                      <p key={j} className="mb-3 last:mb-0">
                        {para}
                      </p>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-1">
        {PRIMARY_FIELDS.map(({ key, label }) => (
          <Section key={key} label={label} text={m[key]} />
        ))}
      </div>

      <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Supplementary context
        </summary>
        <div className="flex flex-col gap-5 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
          {SUPPLEMENTARY_FIELDS.map(({ key, label }) => (
            <Section key={key} label={label} text={m[key]} />
          ))}
        </div>
      </details>
    </div>
  );
}
