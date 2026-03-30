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
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [regenerateDrafts, setRegenerateDrafts] = useState<Record<string, string>>({});
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const entryKey = useCallback((e: GeneratedHpiEntry) => `${e.createdAt}\n${e.text}`, []);

  const appendRegenerateLine = useCallback((k: string, line: string) => {
    const chunk = line.trim();
    if (!chunk) return;
    setRegenerateDrafts((prev) => {
      const cur = (prev[k] ?? "").trimEnd();
      const next = cur ? `${cur}\n${chunk}` : chunk;
      return { ...prev, [k]: next };
    });
  }, []);

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

  const onReviewHpiEntry = useCallback(
    async (entry: GeneratedHpiEntry) => {
      if (!caseId?.trim()) return;
      setReviewError(null);
      const key = entryKey(entry);
      setReviewingKey(key);
      try {
        const res = await fetch(`/api/cases/${caseId}/generated-hpi/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ createdAt: entry.createdAt, text: entry.text }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          generatedHPI?: GeneratedHpiEntry[];
          error?: string;
        };
        if (!res.ok) {
          setReviewError(data.error ?? `Review failed (${res.status})`);
          return;
        }
        if (Array.isArray(data.generatedHPI)) {
          onGeneratedHpiChange?.(data.generatedHPI);
        }
      } catch {
        setReviewError("Review request failed");
      } finally {
        setReviewingKey(null);
      }
    },
    [caseId, entryKey, onGeneratedHpiChange],
  );

  const onRegenerateFromNotes = useCallback(
    async (entry: GeneratedHpiEntry, improvementNotes: string) => {
      const trimmed = improvementNotes.trim();
      if (!trimmed || !caseId?.trim()) return;
      const k = entryKey(entry);
      setRegenerateError(null);
      setRegeneratingKey(k);
      try {
        const res = await fetch(`/api/cases/${caseId}/regenerate-hpi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalHpiText: entry.text,
            improvementNotes: trimmed,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          hpi?: string;
          generatedHPI?: GeneratedHpiEntry[];
          error?: string;
        };
        if (!res.ok) {
          setRegenerateError(data.error ?? `Regeneration failed (${res.status})`);
          return;
        }
        if (typeof data.hpi === "string" && data.hpi.trim() && Array.isArray(data.generatedHPI)) {
          onGeneratedHpiChange?.(data.generatedHPI);
          setRegenerateDrafts((prev) => {
            const { [k]: _, ...rest } = prev;
            return rest;
          });
        } else {
          setRegenerateError("Empty response");
        }
      } catch {
        setRegenerateError("Regeneration request failed");
      } finally {
        setRegeneratingKey(null);
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
            disabled={hpiLoading || !caseId?.trim() || regeneratingKey !== null}
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
        {reviewError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{reviewError}</p>
        ) : null}
        {regenerateError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{regenerateError}</p>
        ) : null}
        {generatedHPI.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Generated HPI (history)
            </h3>
            {reversedHpi.map((entry, idx) => {
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
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void onReviewHpiEntry(entry);
                        }}
                        disabled={
                          reviewingKey !== null || deletingKey !== null || regeneratingKey !== null
                        }
                        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      >
                        {reviewingKey === k
                          ? "…"
                          : entry.reviewGeneratedAt
                            ? "Regenerate review"
                            : "Review"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void onDeleteHpiEntry(entry);
                        }}
                        disabled={
                          deletingKey !== null || reviewingKey !== null || regeneratingKey !== null
                        }
                        className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                      >
                        {deletingKey === k ? "…" : "Delete"}
                      </button>
                    </div>
                  </summary>
                  <div className="border-t border-zinc-200 px-3 py-3 text-sm leading-relaxed text-foreground dark:border-zinc-800">
                    {entry.text.split("\n\n").map((para, j) => (
                      <p key={j} className="mb-3 last:mb-0">
                        {para}
                      </p>
                    ))}
                    {entry.score || entry.improvement ? (
                      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90">
                            Payer / insurance readiness
                          </span>
                          {entry.reviewGeneratedAt ? (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              Reviewed {new Date(entry.reviewGeneratedAt).toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          Educational QA to reduce documentation-related denial risk—not a guarantee of
                          coverage or payment.
                        </p>
                        {entry.score ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="text-2xl font-semibold tabular-nums text-foreground">
                                {Math.round(entry.score.overall)}
                              </span>
                              <span className="text-sm text-zinc-500 dark:text-zinc-400">/ 100</span>
                            </div>
                            <p className="text-sm text-foreground">{entry.score.summary}</p>
                            {entry.score.missingPoints.length > 0 ? (
                              <div>
                                <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                  Missing or thin points{" "}
                                  <span className="font-normal text-zinc-500">(click to append)</span>
                                </p>
                                <ul className="flex flex-col gap-1 text-sm text-foreground">
                                  {entry.score.missingPoints.map((line, idx) => (
                                    <li key={idx} className="list-none">
                                      <button
                                        type="button"
                                        onClick={() => appendRegenerateLine(k, line)}
                                        className="w-full rounded-md border border-transparent px-1.5 py-1 text-left leading-snug text-foreground transition-colors hover:border-zinc-200 hover:bg-white/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
                                      >
                                        <span className="mr-1.5 text-zinc-400">+</span>
                                        {line}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {entry.score.inconsistencies.length > 0 ? (
                              <div>
                                <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-200/80">
                                  Inconsistencies{" "}
                                  <span className="font-normal text-amber-700/80 dark:text-amber-300/70">
                                    (click to append)
                                  </span>
                                </p>
                                <ul className="flex flex-col gap-1 text-sm">
                                  {entry.score.inconsistencies.map((line, idx) => (
                                    <li key={idx} className="list-none">
                                      <button
                                        type="button"
                                        onClick={() => appendRegenerateLine(k, line)}
                                        className="w-full rounded-md border border-transparent px-1.5 py-1 text-left leading-snug text-amber-950 transition-colors hover:border-amber-200 hover:bg-amber-100/60 dark:text-amber-100/90 dark:hover:border-amber-800 dark:hover:bg-amber-950/40"
                                      >
                                        <span className="mr-1.5 text-amber-600 dark:text-amber-400">
                                          +
                                        </span>
                                        {line}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {entry.improvement ? (
                          <div>
                            <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              Suggested improvements{" "}
                              <span className="font-normal text-zinc-500">(click a paragraph)</span>
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {entry.improvement
                                .split(/\n{2,}/)
                                .map((p) => p.trim())
                                .filter(Boolean)
                                .map((para, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => appendRegenerateLine(k, para)}
                                    className="rounded-md border border-zinc-200 bg-white/80 px-2.5 py-2 text-left text-sm leading-relaxed text-foreground transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-zinc-600"
                                  >
                                    {para}
                                  </button>
                                ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-1 border-t border-amber-200/70 pt-3 dark:border-amber-900/40">
                          <label
                            htmlFor={`regen-notes-${idx}`}
                            className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                          >
                            Regeneration notes
                            <span className="ml-1 font-normal text-zinc-500">
                              (not saved; sent with this HPI and the clinical summary to the model)
                            </span>
                          </label>
                          <textarea
                            id={`regen-notes-${idx}`}
                            value={regenerateDrafts[k] ?? ""}
                            onChange={(e) =>
                              setRegenerateDrafts((prev) => ({ ...prev, [k]: e.target.value }))
                            }
                            rows={5}
                            placeholder="Add priorities for the revised HPI, or click items above to append…"
                            className="w-full resize-y rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm outline-none ring-offset-background focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-zinc-500"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void onRegenerateFromNotes(entry, regenerateDrafts[k] ?? "")
                              }
                              disabled={
                                !caseId?.trim() ||
                                !(regenerateDrafts[k] ?? "").trim() ||
                                regeneratingKey !== null ||
                                reviewingKey !== null ||
                                deletingKey !== null
                              }
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                            >
                              {regeneratingKey === k ? "Regenerating…" : "Regenerate HPI"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
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
