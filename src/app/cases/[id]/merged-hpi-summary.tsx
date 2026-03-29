import type { MergedForHpi } from "@/models/case";

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
  text: string;
}) {
  const trimmed = text.trim();
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

export function MergedHpiSummary({ merged }: { merged: MergedForHpi }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 id="merged-hpi-heading" className="text-lg font-semibold tracking-tight">
          Summarized clinical layer
        </h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Normalized merge across uploaded files for HPI generation. Updates when you add or remove a
          source document.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-1">
        {PRIMARY_FIELDS.map(({ key, label }) => (
          <Section key={key} label={label} text={merged[key]} />
        ))}
      </div>

      <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Supplementary context
        </summary>
        <div className="flex flex-col gap-5 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
          {SUPPLEMENTARY_FIELDS.map(({ key, label }) => (
            <Section key={key} label={label} text={merged[key]} />
          ))}
        </div>
      </details>
    </div>
  );
}
