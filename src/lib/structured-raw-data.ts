import { z } from "zod";
import {
  caseStructuredRawDataSchema,
  emptyStructuredRawData,
  labResultSchema,
  sourceStructuredSnapshotSchema,
  vitalSignSchema,
  type CaseStructuredRawData,
  type LabResult,
  type MergedForHpi,
  type PhysicalExam,
  type SourceStructuredSnapshot,
  type VitalSign,
} from "@/models/case";
import type { ParsedERNote, ParsedHP, ParsedOtherNote } from "@/models/case";
import type { SourceDocument } from "@/types/case";

function sourceLabel(s: SourceStructuredSnapshot, index: number): string {
  return s.fileName?.trim() || `Source ${index + 1} (${s.type})`;
}

const PE_LABELS: Record<string, string> = {
  generalAppearance: "General",
  heent: "HEENT",
  neck: "Neck",
  lungs: "Lungs",
  heart: "Heart",
  abdomen: "Abdomen",
  extremities: "Extremities",
  neurologic: "Neuro",
  vascular: "Vascular",
  skin: "Skin",
  psych: "Psych",
};

export function formatPhysicalExam(pe: PhysicalExam | undefined): string {
  if (!pe || typeof pe !== "object") return "";
  return Object.entries(pe)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `**${PE_LABELS[k] ?? k}**: ${(v as string).trim()}`)
    .join("\n");
}

function formatLabsMarkdown(
  sources: SourceStructuredSnapshot[],
  filter: (lab: { isAbnormal: boolean }) => boolean,
): string {
  const blocks: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const labs = (s.labResults ?? []).filter(filter);
    if (labs.length === 0) continue;
    const lines: string[] = [`### ${sourceLabel(s, i)}`];
    for (const lab of labs) {
      const flag = lab.isAbnormal ? " (abnormal)" : "";
      lines.push(
        `- **${lab.testName}**: ${String(lab.result)} ${lab.units} (ref ${lab.referenceRange})${flag}`,
      );
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n").trim();
}

function formatVitalsMarkdown(sources: SourceStructuredSnapshot[]): string {
  const blocks: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const vitals = s.vitalsigns ?? [];
    if (vitals.length === 0) continue;
    const lines: string[] = [`### ${sourceLabel(s, i)}`];
    for (const v of vitals) {
      const parts: string[] = [];
      if (v.dateTime) parts.push(v.dateTime);
      if (v.bpMmHg) parts.push(`BP ${v.bpMmHg}`);
      if (v.heartRate != null) parts.push(`HR ${v.heartRate}`);
      if (v.tempCelsius != null) parts.push(`T ${v.tempCelsius}°C`);
      if (v.spo2Percent != null) parts.push(`SpO₂ ${v.spo2Percent}%`);
      lines.push(`- ${parts.join(" · ") || JSON.stringify(v)}`);
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n").trim();
}

function fallbackTimeline(s: SourceStructuredSnapshot): string {
  if (s.timeline?.trim()) return s.timeline.trim();
  if (s.type === "OTHER") return (s.summary ?? "").trim();
  return (s.hpiSummary ?? "").trim();
}

function fallbackSymptoms(s: SourceStructuredSnapshot): string {
  if (s.symptoms?.trim()) return s.symptoms.trim();
  if (s.type === "OTHER") return (s.summary ?? "").trim();
  const cc = (s.chiefComplaint ?? "").trim();
  const hpi = (s.hpiSummary ?? "").trim();
  if (cc && hpi) return `${cc}\n\n${hpi}`;
  return cc || hpi;
}

function fallbackPositives(s: SourceStructuredSnapshot): string {
  if (s.positives?.trim()) return s.positives.trim();
  return (s.reviewOfSystems ?? "").trim();
}

function blockFor(
  sources: SourceStructuredSnapshot[],
  getText: (s: SourceStructuredSnapshot, index: number) => string,
): string {
  const parts: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const text = getText(sources[i], i).trim();
    if (!text) continue;
    parts.push(`### ${sourceLabel(sources[i], i)}\n${text}`);
  }
  return parts.join("\n\n");
}

export function mergeSnapshotsForHpi(sources: SourceStructuredSnapshot[]): MergedForHpi {
  const chiefParts: string[] = [];
  const hpiParts: string[] = [];
  const rosParts: string[] = [];
  const allergyParts: string[] = [];
  const medParts: string[] = [];

  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const label = sourceLabel(s, i);

    if (s.type === "OTHER") {
      const text = (s.summary ?? "").trim();
      if (text) {
        chiefParts.push(`### ${label}\n${text}`);
        hpiParts.push(`### ${label}\n${text}`);
      }
      continue;
    }

    const cc = (s.chiefComplaint ?? "").trim();
    if (cc) chiefParts.push(`### ${label}\n${cc}`);

    const hpi = (s.hpiSummary ?? "").trim();
    if (hpi) hpiParts.push(`### ${label}\n${hpi}`);

    const ros = (s.reviewOfSystems ?? "").trim();
    if (ros) rosParts.push(`### ${label}\n${ros}`);

    const allergies = (s.allergies ?? "").trim();
    if (allergies) allergyParts.push(`### ${label}\n${allergies}`);

    const meds = (s.medications ?? "").trim();
    if (meds) medParts.push(`### ${label}\n${meds}`);
  }

  return {
    timeline: blockFor(sources, (s) => fallbackTimeline(s)),
    symptoms: blockFor(sources, (s) => fallbackSymptoms(s)),
    positives: blockFor(sources, (s) => fallbackPositives(s)),
    negatives: blockFor(sources, (s) => (s.negatives ?? "").trim()),
    abnormalLabs: formatLabsMarkdown(sources, (l) => l.isAbnormal),
    keyExamFindings: blockFor(sources, (s) => (s.keyExamFindings ?? "").trim()),
    diagnosisClues: blockFor(sources, (s) => (s.diagnosisClues ?? "").trim()),
    admissionRationale: blockFor(sources, (s) => (s.admissionRationale ?? "").trim()),
    chiefComplaints: chiefParts.join("\n\n"),
    hpiNarratives: hpiParts.join("\n\n"),
    rosCombined: rosParts.join("\n\n"),
    allergies: allergyParts.join("\n\n"),
    medications: medParts.join("\n\n"),
    allLabsMarkdown: formatLabsMarkdown(sources, () => true),
    vitalsMarkdown: formatVitalsMarkdown(sources),
  };
}

function snapshotFromSourceDocument(sd: SourceDocument): SourceStructuredSnapshot {
  const base: Pick<SourceStructuredSnapshot, "fileName" | "type"> = {
    fileName: sd.fileName,
    type: sd.type,
  };
  const o = sd.structuredOutput;

  if (o == null || typeof o !== "object") {
    if (sd.type === "OTHER") return { ...base, summary: "" };
    return { ...base };
  }

  if (sd.type === "OTHER") {
    const summary =
      "summary" in o && typeof (o as ParsedOtherNote).summary === "string"
        ? (o as ParsedOtherNote).summary
        : "";
    return {
      ...base,
      summary,
      timeline: summary,
      symptoms: summary,
      positives: summary,
    };
  }

  if (sd.type === "HP_NOTE") {
    const p = o as ParsedHP;
    const timeline = p.hpi?.timeline?.filter(Boolean).join("\n") ?? "";
    const symptoms =
      p.hpi?.symptoms?.filter(Boolean).join("\n") ?? p.hpi?.summary?.trim() ?? "";
    const positives = p.reviewOfSystems?.summary?.trim() ?? "";
    const keyExamFindings = formatPhysicalExam(p.physicalExam);
    const diagnosisClues =
      p.assessmentPlan?.problems
        ?.map(
          (pr) =>
            `${pr.diagnosis}${pr.qualifiers?.length ? ` (${pr.qualifiers.join(", ")})` : ""}: ${pr.planItems.join("; ")}`,
        )
        .join("\n\n") ?? "";
    const admissionRationale = p.hpi?.admissionReason?.filter(Boolean).join("\n") ?? "";

    return {
      ...base,
      chiefComplaint: p.chiefComplaint,
      hpiSummary: p.hpi?.summary,
      reviewOfSystems: p.reviewOfSystems?.summary,
      allergies: p.history?.allergies,
      medications: p.history?.medications,
      labResults: p.labResults,
      vitalsigns: p.vitalsigns,
      timeline,
      symptoms,
      positives,
      negatives: "",
      keyExamFindings,
      diagnosisClues,
      admissionRationale,
    };
  }

  const p = o as ParsedERNote;
  const timeline =
    p.medicalDecisionErCourse?.presentationRecap?.trim() ||
    p.hpiSummary?.trim() ||
    "";
  const symptoms = [p.chiefComplaint?.trim(), p.hpiSummary?.trim()].filter(Boolean).join("\n\n");
  const keyExamFindings = formatPhysicalExam(p.physicalExam);
  const diagnosisClues = p.clinicalImpression?.filter(Boolean).join("\n") ?? "";
  const admissionRationale = [p.condition?.trim(), p.disposition?.trim()].filter(Boolean).join("\n");

  return {
    ...base,
    chiefComplaint: p.chiefComplaint,
    hpiSummary: p.hpiSummary,
    reviewOfSystems: p.reviewOfSystems,
    allergies: p.history?.allergies,
    medications: p.history?.medications,
    labResults: p.labResults,
    vitalsigns: p.vitalsigns,
    timeline,
    symptoms,
    positives: p.reviewOfSystems,
    negatives: "",
    keyExamFindings,
    diagnosisClues,
    admissionRationale,
  };
}

/** Rebuilds the summarized layer from **every** current `sourceDocument` (add = append to array; remove = re-merge remaining). */
export function rebuildStructuredRawDataFromDocuments(
  sourceDocuments: SourceDocument[],
  updatedAt: Date = new Date(),
): CaseStructuredRawData {
  const sources = sourceDocuments.map(snapshotFromSourceDocument);
  return {
    version: 2,
    updatedAt: updatedAt.toISOString(),
    sources,
    mergedForHpi: mergeSnapshotsForHpi(sources),
  };
}

const mergedForHpiV1Schema = z.object({
  chiefComplaints: z.string(),
  hpiNarratives: z.string(),
  rosCombined: z.string(),
  allergies: z.string(),
  medications: z.string(),
  labsMarkdown: z.string(),
  vitalsMarkdown: z.string(),
});

const caseStructuredRawDataV1Schema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  sources: z.array(sourceStructuredSnapshotSchema),
  mergedForHpi: mergedForHpiV1Schema,
});

function migrateV1ToV2(
  v1: z.infer<typeof caseStructuredRawDataV1Schema>,
): CaseStructuredRawData {
  return {
    version: 2,
    updatedAt: v1.updatedAt,
    sources: v1.sources,
    mergedForHpi: mergeSnapshotsForHpi(v1.sources),
  };
}

function sanitizeLabRow(row: unknown): Record<string, unknown> {
  if (row == null || typeof row !== "object") {
    return {
      testName: "",
      result: "",
      units: "",
      referenceRange: "",
      isAbnormal: false,
    };
  }
  const r = row as Record<string, unknown>;
  const result = r.result;
  return {
    testName: String(r.testName ?? ""),
    result: typeof result === "number" || typeof result === "string" ? result : String(result ?? ""),
    units: String(r.units ?? ""),
    referenceRange: String(r.referenceRange ?? ""),
    isAbnormal: r.isAbnormal === true || r.isAbnormal === "true",
  };
}

function sanitizeVitalRow(row: unknown): Record<string, unknown> {
  if (row == null || typeof row !== "object") {
    return { dateTime: "" };
  }
  const r = row as Record<string, unknown>;
  return {
    ...r,
    dateTime: r.dateTime != null ? String(r.dateTime) : "",
  };
}

function sanitizeSnapshotDeep(s: unknown): unknown {
  if (s == null || typeof s !== "object") return s;
  const o = { ...(s as Record<string, unknown>) };
  if (Array.isArray(o.labResults)) {
    o.labResults = o.labResults.map(sanitizeLabRow);
  }
  if (Array.isArray(o.vitalsigns)) {
    o.vitalsigns = o.vitalsigns.map(sanitizeVitalRow);
  }
  return o;
}

function sanitizeMergedForHpiKeys(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const m = { ...(raw as Record<string, unknown>) };
  for (const k of Object.keys(m)) {
    const v = m[k];
    if (typeof v === "number" || typeof v === "boolean") m[k] = String(v);
  }
  if (typeof m.labsMarkdown === "string" && (m.allLabsMarkdown === undefined || m.allLabsMarkdown === "")) {
    m.allLabsMarkdown = m.labsMarkdown;
  }
  return m;
}

function sanitizeStructuredRawDataInput(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...r };
  if (Array.isArray(r.sources)) {
    out.sources = r.sources.map(sanitizeSnapshotDeep);
  }
  if (r.mergedForHpi != null && typeof r.mergedForHpi === "object") {
    out.mergedForHpi = sanitizeMergedForHpiKeys(r.mergedForHpi);
  }
  return out;
}

function toOptStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const t = String(v).trim();
  return t === "" ? undefined : t;
}

function coerceLabResultsArray(raw: unknown): LabResult[] {
  if (!Array.isArray(raw)) return [];
  const out: LabResult[] = [];
  for (const row of raw) {
    const p = labResultSchema.safeParse(sanitizeLabRow(row));
    if (p.success) out.push(p.data);
  }
  return out;
}

function coerceVitalsArray(raw: unknown): VitalSign[] {
  if (!Array.isArray(raw)) return [];
  const out: VitalSign[] = [];
  for (const row of raw) {
    const p = vitalSignSchema.safeParse(sanitizeVitalRow(row));
    if (p.success) out.push(p.data);
  }
  return out;
}

/** Never drop a source row: lenient parse for DB / API recovery. */
function coerceSnapshotForRead(s: unknown): SourceStructuredSnapshot {
  const sanitized = sanitizeSnapshotDeep(s);
  const p = sourceStructuredSnapshotSchema.safeParse(sanitized);
  if (p.success) return p.data;

  const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
  const typeRaw = o.type;
  const type =
    typeRaw === "ER_NOTE" || typeRaw === "HP_NOTE" || typeRaw === "OTHER" ? typeRaw : "OTHER";

  const fallback = {
    type,
    fileName: typeof o.fileName === "string" ? o.fileName : undefined,
    chiefComplaint: toOptStr(o.chiefComplaint),
    hpiSummary: toOptStr(o.hpiSummary),
    reviewOfSystems: toOptStr(o.reviewOfSystems),
    allergies: toOptStr(o.allergies),
    medications: toOptStr(o.medications),
    labResults: coerceLabResultsArray(o.labResults),
    vitalsigns: coerceVitalsArray(o.vitalsigns),
    summary: toOptStr(o.summary),
    timeline: toOptStr(o.timeline),
    symptoms: toOptStr(o.symptoms),
    positives: toOptStr(o.positives),
    negatives: toOptStr(o.negatives),
    keyExamFindings: toOptStr(o.keyExamFindings),
    diagnosisClues: toOptStr(o.diagnosisClues),
    admissionRationale: toOptStr(o.admissionRationale),
  };

  const again = sourceStructuredSnapshotSchema.safeParse(fallback);
  if (again.success) return again.data;

  return sourceStructuredSnapshotSchema.parse({ type: "OTHER", summary: "" });
}

function normalizeMergedForHpiLoose(raw: unknown): MergedForHpi {
  const base = { ...emptyStructuredRawData().mergedForHpi };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(base) as (keyof MergedForHpi)[]) {
    const v = o[k];
    if (typeof v === "string") base[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") base[k] = String(v);
  }
  if (!base.allLabsMarkdown.trim() && typeof o.labsMarkdown === "string") {
    base.allLabsMarkdown = o.labsMarkdown;
  }
  return base;
}

export function normalizeStructuredRawData(raw: unknown): CaseStructuredRawData {
  const sanitized = sanitizeStructuredRawDataInput(raw);

  const v2 = caseStructuredRawDataSchema.safeParse(sanitized);
  if (v2.success) return v2.data;

  const v1 = caseStructuredRawDataV1Schema.safeParse(sanitized);
  if (v1.success) return migrateV1ToV2(v1.data);

  if (raw != null && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const updatedAt =
      typeof r.updatedAt === "string"
        ? r.updatedAt
        : r.updatedAt instanceof Date
          ? r.updatedAt.toISOString()
          : new Date().toISOString();

    const mergedFromDb = normalizeMergedForHpiLoose(r.mergedForHpi);

    const sourcesArray = Array.isArray(r.sources) ? r.sources : [];
    const sourcesSanitized = sourcesArray.map((s) => coerceSnapshotForRead(s));

    if (sourcesSanitized.length > 0) {
      return {
        version: 2,
        updatedAt,
        sources: sourcesSanitized,
        mergedForHpi: mergeSnapshotsForHpi(sourcesSanitized),
      };
    }

    if (Object.values(mergedFromDb).some((v) => String(v).trim() !== "")) {
      return {
        version: 2,
        updatedAt,
        sources: [],
        mergedForHpi: mergedFromDb,
      };
    }
  }

  return emptyStructuredRawData();
}
