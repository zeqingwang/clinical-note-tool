"use client";

import type { ReactNode } from "react";
import type { SourceDocumentType } from "@/types/case";

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40"
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="text-zinc-400 transition-transform group-open:rotate-90">▸</span>
          {title}
        </span>
      </summary>
      <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">{children}</div>
    </details>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

function labDisplayCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const s = String(value).trim();
  return s.length > 0 ? s : "—";
}

function LabFlagCell({ lab }: { lab: Record<string, unknown> }) {
  if (lab.isAbnormal === true) {
    return (
      <span className="rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-900 dark:bg-red-900/50 dark:text-red-100">
        Abnormal
      </span>
    );
  }
  if (lab.isAbnormal === false) {
    return <span className="text-zinc-600 dark:text-zinc-400">Normal</span>;
  }
  return (
    <span className="text-zinc-400" title="Not provided in extracted data for this row">
      —
    </span>
  );
}

/** Shared ER + HP: same columns so ref/flag are never missing from the UI for one note type only. */
function LabResultsTable({ labs }: { labs: unknown[] }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
        Units, reference range, or flag may show “—” when that field was not returned for a given test (often varies by row in the source extract).
      </p>
      <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="py-1.5 pr-2 font-medium text-zinc-600 dark:text-zinc-400">Test</th>
            <th className="py-1.5 pr-2 font-medium text-zinc-600 dark:text-zinc-400">Result</th>
            <th className="py-1.5 pr-2 font-medium text-zinc-600 dark:text-zinc-400">Units</th>
            <th className="py-1.5 pr-2 font-medium text-zinc-600 dark:text-zinc-400">Reference range</th>
            <th className="py-1.5 font-medium text-zinc-600 dark:text-zinc-400">Flag</th>
          </tr>
        </thead>
        <tbody>
          {labs.map((row, i) => {
            const lab = row as Record<string, unknown>;
            const abnormal = lab.isAbnormal === true;
            return (
              <tr
                key={i}
                className={
                  abnormal
                    ? "border-b border-red-100 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/30"
                    : "border-b border-zinc-100 dark:border-zinc-800/80"
                }
              >
                <td className="py-1.5 pr-2 align-top font-medium text-foreground">
                  {labDisplayCell(lab.testName)}
                </td>
                <td className="py-1.5 pr-2 align-top">{labDisplayCell(lab.result)}</td>
                <td className="py-1.5 pr-2 align-top text-zinc-700 dark:text-zinc-300">{labDisplayCell(lab.units)}</td>
                <td className="py-1.5 pr-2 align-top text-zinc-700 dark:text-zinc-300">
                  {labDisplayCell(lab.referenceRange)}
                </td>
                <td className="py-1.5 align-top">
                  <LabFlagCell lab={lab} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Matches `VitalSign` in `@/models/case` — order + labels for display. */
const VITAL_FIELD_ORDER = [
  "dateTime",
  "bpMmHg",
  "bpPosition",
  "mapMmHg",
  "heartRate",
  "pulseSite",
  "respirationRate",
  "tempCelsius",
  "tempFahrenheit",
  "spo2Percent",
  "o2LitersPerMin",
  "fio2",
  "etco2MmHg",
  "o2Device",
  "bloodSugar",
  "painScore",
  "heightInches",
  "heightCm",
  "weightKg",
  "weightLbsOz",
  "scale",
  "bmi",
  "bsa",
  "headCircumferenceCm",
] as const;

const VITAL_LABELS: Record<string, string> = {
  dateTime: "Date / time",
  bpMmHg: "Blood pressure",
  bpPosition: "BP position / site",
  mapMmHg: "MAP",
  heartRate: "Heart rate",
  pulseSite: "Pulse site",
  respirationRate: "Respiratory rate",
  tempCelsius: "Temp (°C)",
  tempFahrenheit: "Temp (°F)",
  spo2Percent: "SpO₂",
  o2LitersPerMin: "O₂ (L/min)",
  fio2: "FiO₂",
  etco2MmHg: "EtCO₂",
  o2Device: "O₂ device / delivery",
  bloodSugar: "Glucose",
  painScore: "Pain",
  heightInches: "Height (in)",
  heightCm: "Height (cm)",
  weightKg: "Weight (kg)",
  weightLbsOz: "Weight (lb/oz)",
  scale: "Scale",
  bmi: "BMI",
  bsa: "BSA",
  headCircumferenceCm: "Head circ. (cm)",
};

function vitalValueHasContent(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (typeof val === "number") return !Number.isNaN(val);
  return true;
}

function formatVitalValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") {
    if (key === "mapMmHg" || key === "etco2MmHg") return `${val} mmHg`;
    if (key === "heartRate") return `${val} bpm`;
    if (key === "respirationRate") return `${val} /min`;
    if (key === "spo2Percent") return `${val}%`;
    if (key === "o2LitersPerMin") return `${val} L/min`;
    if (key === "tempCelsius") return `${val} °C`;
    if (key === "tempFahrenheit") return `${val} °F`;
    if (key === "heightInches") return `${val} in`;
    if (key === "heightCm") return `${val} cm`;
    if (key === "weightKg") return `${val} kg`;
    if (key === "headCircumferenceCm") return `${val} cm`;
    if (key === "bmi") return String(val);
    if (key === "bsa") return String(val);
    return String(val);
  }
  return String(val).trim();
}

function VitalSetsDisplay({ vitals }: { vitals: unknown[] }) {
  return (
    <div className="flex flex-col gap-3">
      {vitals.map((row, index) => {
        const v = row as Record<string, unknown>;
        const title =
          typeof v.dateTime === "string" && v.dateTime.trim()
            ? v.dateTime.trim()
            : `Vital set ${index + 1}`;

        const known = new Set<string>(VITAL_FIELD_ORDER);
        const entries: { key: string; label: string; value: string }[] = [];

        for (const key of VITAL_FIELD_ORDER) {
          if (key === "dateTime") continue;
          const val = v[key];
          if (!vitalValueHasContent(val)) continue;
          entries.push({
            key,
            label: VITAL_LABELS[key] ?? key,
            value: formatVitalValue(key, val),
          });
        }

        for (const [key, val] of Object.entries(v)) {
          if (known.has(key)) continue;
          if (!vitalValueHasContent(val)) continue;
          entries.push({
            key,
            label: VITAL_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
            value: formatVitalValue(key, val),
          });
        }

        return (
          <div
            key={index}
            className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <p className="mb-2 border-b border-zinc-200 pb-2 text-sm font-semibold text-foreground dark:border-zinc-700">
              {title}
            </p>
            {entries.length === 0 ? (
              <p className="text-xs text-zinc-500">No vital fields in this row.</p>
            ) : (
              <dl className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map(({ key, label, value }) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {label}
                    </dt>
                    <dd className="break-words text-sm text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ErStructuredView({ data }: { data: Record<string, unknown> }) {
  const history = data.history as Record<string, string> | undefined;
  const vitals = Array.isArray(data.vitalsigns) ? data.vitalsigns : [];
  const pe = data.physicalExam as Record<string, string> | undefined;
  const labs = Array.isArray(data.labResults) ? data.labResults : [];
  const mdm = data.medicalDecisionErCourse as Record<string, unknown> | undefined;
  const impressions = Array.isArray(data.clinicalImpression) ? data.clinicalImpression : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldBlock label="Chief complaint" value={String(data.chiefComplaint ?? "")} />
        <FieldBlock label="Condition" value={String(data.condition ?? "")} />
        <FieldBlock label="Disposition" value={String(data.disposition ?? "")} />
      </div>
      <FieldBlock label="HPI" value={String(data.hpiSummary ?? "")} />
      <FieldBlock label="Review of systems" value={String(data.reviewOfSystems ?? "")} />

      {history && (
        <Section title="History">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="PMH" value={history.pastMedicalHistory ?? ""} />
            <FieldBlock label="PSH" value={history.pastSurgicalHistory ?? ""} />
            <FieldBlock label="Allergies" value={history.allergies ?? ""} />
            <FieldBlock label="Family" value={history.familyHistory ?? ""} />
            <FieldBlock label="Social" value={history.socialHistory ?? ""} />
            <FieldBlock label="Medications" value={history.medications ?? ""} />
          </div>
        </Section>
      )}

      {vitals.length > 0 ? (
        <Section title={`Vital signs (${vitals.length})`}>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Each row lists every populated field from the note, including text (e.g. BP arm, O₂ device).
          </p>
          <VitalSetsDisplay vitals={vitals} />
        </Section>
      ) : null}

      {pe && (
        <Section title="Physical exam" defaultOpen={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(pe).map(([k, val]) => (
              <FieldBlock
                key={k}
                label={k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                value={String(val ?? "")}
              />
            ))}
          </div>
        </Section>
      )}

      {labs.length > 0 ? (
        <Section title={`Laboratory (${labs.length})`}>
          <LabResultsTable labs={labs} />
        </Section>
      ) : null}

      {mdm && typeof mdm === "object" && (
        <Section title="Medical decision / ER course" defaultOpen={false}>
          <div className="flex flex-col gap-2">
            {Object.entries(mdm).map(([key, val]) => {
              if (val == null || val === "") return null;
              if (typeof val === "object") {
                return (
                  <div key={key} className="rounded-md bg-zinc-50 px-2 py-1.5 text-xs dark:bg-zinc-900/60">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">{key}: </span>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-sans text-foreground">
                      {JSON.stringify(val, null, 2)}
                    </pre>
                  </div>
                );
              }
              return <FieldBlock key={key} label={key} value={String(val)} />;
            })}
          </div>
        </Section>
      )}

      {impressions.length > 0 ? (
        <Section title="Clinical impression" defaultOpen>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {impressions.map((line, i) => (
              <li key={i}>{String(line)}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function HpStructuredView({ data }: { data: Record<string, unknown> }) {
  const vitals = Array.isArray(data.vitalsigns) ? data.vitalsigns : [];
  const labs = Array.isArray(data.labResults) ? data.labResults : [];
  const history = data.history as Record<string, string> | undefined;
  const pe = data.physicalExam as Record<string, string> | undefined;
  const hpi = data.hpi as Record<string, unknown> | undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {data.date != null ? <FieldBlock label="Date" value={String(data.date)} /> : null}
        <FieldBlock label="Chief complaint" value={String(data.chiefComplaint ?? "")} />
      </div>

      {hpi && typeof hpi === "object" && (
        <Section title="HPI">
          <div className="flex flex-col gap-2 text-sm">
            {hpi.summary != null ? <FieldBlock label="Summary" value={String(hpi.summary)} /> : null}
            {Array.isArray(hpi.timeline) && hpi.timeline.length > 0 ? (
              <ul className="list-inside list-disc">
                {(hpi.timeline as unknown[]).map((t, i) => (
                  <li key={i}>{String(t)}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </Section>
      )}

      {history && (
        <Section title="History" defaultOpen={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(history).map(([k, v]) => (
              <FieldBlock key={k} label={k} value={String(v ?? "")} />
            ))}
          </div>
        </Section>
      )}

      {vitals.length > 0 ? (
        <Section title={`Vitals (${vitals.length})`} defaultOpen={false}>
          <VitalSetsDisplay vitals={vitals} />
        </Section>
      ) : null}

      {pe && (
        <Section title="Physical exam" defaultOpen={false}>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(pe).map(([k, val]) => (
              <FieldBlock key={k} label={k} value={String(val ?? "")} />
            ))}
          </div>
        </Section>
      )}

      {labs.length > 0 ? (
        <Section title={`Labs (${labs.length})`} defaultOpen={false}>
          <LabResultsTable labs={labs} />
        </Section>
      ) : null}

      {data.assessmentPlan != null ? (
        <Section title="Assessment & plan" defaultOpen={false}>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900/60">
            {JSON.stringify(data.assessmentPlan, null, 2)}
          </pre>
        </Section>
      ) : null}

      {data.encounterMetadata != null ? (
        <Section title="Encounter metadata" defaultOpen={false}>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900/60">
            {JSON.stringify(data.encounterMetadata, null, 2)}
          </pre>
        </Section>
      ) : null}
    </div>
  );
}

function OtherStructuredView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Summary</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{String(data.summary ?? "")}</p>
    </div>
  );
}

export function StructuredOutputView({
  docType,
  data,
}: {
  docType: SourceDocumentType;
  data: unknown;
}) {
  if (data == null || typeof data !== "object") {
    return <p className="text-sm text-zinc-500">No structured data.</p>;
  }

  const o = data as Record<string, unknown>;

  if (docType === "OTHER") {
    return <OtherStructuredView data={o} />;
  }

  if (docType === "HP_NOTE") {
    return <HpStructuredView data={o} />;
  }

  return <ErStructuredView data={o} />;
}

/** Collapsible raw JSON for debugging / copy-out. */
export function RawJsonDetails({ data }: { data: unknown }) {
  return (
    <details className="rounded-lg border border-dashed border-zinc-300 text-xs dark:border-zinc-700">
      <summary className="cursor-pointer px-3 py-2 text-zinc-500 hover:text-foreground">Raw JSON</summary>
      <pre className="max-h-48 overflow-auto border-t border-zinc-200 p-3 font-mono leading-relaxed dark:border-zinc-800">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}
