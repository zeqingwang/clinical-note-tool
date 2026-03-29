import { z } from "zod";
import type { CaseEditableFields, CaseStoredFields, SourceDocument } from "@/types/case";

export const CASE_COLLECTION = "cases" as const;

const sourceDocumentSchema = z.object({
  type: z.enum(["ER_NOTE", "HP_NOTE", "OTHER"]),
  fileName: z.string().optional(),
  structuredOutput: z.unknown(),
});

export const vitalSignSchema = z.object({
  dateTime: z.string(),
  bpMmHg: z.string().optional(),
  bpPosition: z.string().optional(),
  mapMmHg: z.number().optional(),
  heartRate: z.number().optional(),
  pulseSite: z.string().optional(),
  respirationRate: z.number().optional(),
  tempCelsius: z.number().optional(),
  tempFahrenheit: z.number().optional(),
  spo2Percent: z.number().optional(),
  o2LitersPerMin: z.number().optional(),
  fio2: z.union([z.string(), z.number()]).optional(),
  etco2MmHg: z.number().optional(),
  o2Device: z.string().optional(),
  bloodSugar: z.union([z.string(), z.number()]).optional(),
  painScore: z.union([z.string(), z.number()]).optional(),
  heightInches: z.number().optional(),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  weightLbsOz: z.string().optional(),
  scale: z.string().optional(),
  bmi: z.number().optional(),
  bsa: z.number().optional(),
  headCircumferenceCm: z.number().optional(),
});
export type VitalSign = z.infer<typeof vitalSignSchema>;

export const labResultSchema = z.object({
  testName: z.string(),
  result: z.union([z.string(), z.number()]),
  units: z.string(),
  referenceRange: z.string(),
  isAbnormal: z.boolean(),
});
export type LabResult = z.infer<typeof labResultSchema>;

/** One source document flattened for HPI / GPT input (aligned with `StructuredOutput` shapes). */
export const sourceStructuredSnapshotSchema = z.object({
  fileName: z.string().optional(),
  type: z.enum(["ER_NOTE", "HP_NOTE", "OTHER"]),
  chiefComplaint: z.string().optional(),
  hpiSummary: z.string().optional(),
  reviewOfSystems: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  labResults: z.array(labResultSchema).optional(),
  vitalsigns: z.array(vitalSignSchema).optional(),
  /** Populated for `OTHER` notes */
  summary: z.string().optional(),
  /** Per-source normalized clinical layer (merged into `mergedForHpi`) */
  timeline: z.string().optional(),
  symptoms: z.string().optional(),
  positives: z.string().optional(),
  negatives: z.string().optional(),
  keyExamFindings: z.string().optional(),
  diagnosisClues: z.string().optional(),
  admissionRationale: z.string().optional(),
});
export type SourceStructuredSnapshot = z.infer<typeof sourceStructuredSnapshotSchema>;

/**
 * Summarized clinical layer merged across sources — intended for HPI generation and review.
 * Primary fields match the clinical prompt; supplementary fields retain raw-ish markdown.
 */
export const mergedForHpiSchema = z.object({
  timeline: z.string(),
  symptoms: z.string(),
  positives: z.string(),
  negatives: z.string(),
  abnormalLabs: z.string(),
  keyExamFindings: z.string(),
  diagnosisClues: z.string(),
  admissionRationale: z.string(),
  chiefComplaints: z.string(),
  hpiNarratives: z.string(),
  rosCombined: z.string(),
  allergies: z.string(),
  medications: z.string(),
  allLabsMarkdown: z.string(),
  vitalsMarkdown: z.string(),
});
export type MergedForHpi = z.infer<typeof mergedForHpiSchema>;

export const caseStructuredRawDataSchema = z.object({
  version: z.literal(2),
  /** ISO timestamp of last rebuild */
  updatedAt: z.string(),
  sources: z.array(sourceStructuredSnapshotSchema),
  mergedForHpi: mergedForHpiSchema,
});
export type CaseStructuredRawData = z.infer<typeof caseStructuredRawDataSchema>;

const emptyMergedForHpi = (): MergedForHpi => ({
  timeline: "",
  symptoms: "",
  positives: "",
  negatives: "",
  abnormalLabs: "",
  keyExamFindings: "",
  diagnosisClues: "",
  admissionRationale: "",
  chiefComplaints: "",
  hpiNarratives: "",
  rosCombined: "",
  allergies: "",
  medications: "",
  allLabsMarkdown: "",
  vitalsMarkdown: "",
});

export function emptyStructuredRawData(now: Date = new Date()): CaseStructuredRawData {
  return caseStructuredRawDataSchema.parse({
    version: 2,
    updatedAt: now.toISOString(),
    sources: [],
    mergedForHpi: emptyMergedForHpi(),
  });
}

/** Fields persisted on every case document */
export const caseStoredFieldsSchema: z.ZodType<CaseStoredFields> = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  sourceDocuments: z.array(sourceDocumentSchema),
  structuredRawData: caseStructuredRawDataSchema.optional(),
});

/** User-editable fields (form / API body) */
export const caseEditableFieldsSchema: z.ZodType<CaseEditableFields> = z.object({
  title: z.string(),
  content: z.string(),
});

export function createDraftCaseRecord(now: Date = new Date()): CaseStoredFields {
  return caseStoredFieldsSchema.parse({
    title: "",
    content: "",
    createdAt: now,
    updatedAt: now,
    sourceDocuments: [],
    structuredRawData: emptyStructuredRawData(now),
  });
}

export type {
  CaseDetail,
  CaseDocument,
  CaseEditableFields,
  CaseListItem,
  CaseStoredFields,
  SourceDocument,
  SourceDocumentType,
} from "@/types/case";

export type DispositionRecommendation =
  | "ADMIT"
  | "OBSERVE"
  | "DISCHARGE"
  | "UNKNOWN";
export type CaseStatus = "DRAFT" | "GENERATED" | "FINAL";

/**
 * Structured clinical output: **Zod schemas** are the single source of truth.
 * - Types: `export type X = z.infer<typeof xSchema>`
 * - LLM prompts: `schema.toJSONSchema()` via {@link schemaToPromptBlock}
 *
 * Plain TypeScript `interface` cannot produce runtime JSON Schema without extra tooling.
 */

export const historySchema = z.object({
  pastMedicalHistory: z.string(),
  pastSurgicalHistory: z.string(),
  allergies: z.string(),
  familyHistory: z.string(),
  socialHistory: z.string(),
  medications: z.string(),
});
export type History = z.infer<typeof historySchema>;

export const physicalExamSchema = z.object({
  generalAppearance: z.string(),
  heent: z.string(),
  neck: z.string(),
  lungs: z.string(),
  heart: z.string(),
  abdomen: z.string(),
  extremities: z.string(),
  neurologic: z.string(),
  vascular: z.string(),
  skin: z.string(),
  psych: z.string(),
});
export type PhysicalExam = z.infer<typeof physicalExamSchema>;

export const criticalCareTimeNoteSchema = z.object({
  minutes: z.number().optional(),
  narrative: z.string(),
});

export const medicalDecisionErCourseSchema = z.object({
  evaluationAndMonitoring: z.string().optional(),
  presentationRecap: z.string().optional(),
  differentialAndReasoning: z.string().optional(),
  dataReviewAndStudies: z.string().optional(),
  interventionsAndManagement: z.string().optional(),
  consultations: z.string().optional(),
  criticalCareTime: criticalCareTimeNoteSchema.optional(),
  fullNarrative: z.string().optional(),
});
export type MedicalDecisionErCourse = z.infer<typeof medicalDecisionErCourseSchema>;
export type CriticalCareTimeNote = z.infer<typeof criticalCareTimeNoteSchema>;

export const parsedERNoteSchema = z.object({
  chiefComplaint: z.string(),
  hpiSummary: z.string(),
  history: historySchema,
  reviewOfSystems: z.string(),
  vitalsigns: z.array(vitalSignSchema),
  physicalExam: physicalExamSchema,
  labResults: z.array(labResultSchema),
  medicalDecisionErCourse: medicalDecisionErCourseSchema,
  clinicalImpression: z.array(z.string()),
  condition: z.string(),
  disposition: z.string(),
});
export type ParsedERNote = z.infer<typeof parsedERNoteSchema>;

/** ER narrative pass: labs merged separately — `labResults` must be []. */
export const parsedERNoteBodySchema = parsedERNoteSchema.extend({
  labResults: z.tuple([]),
});

const hpiHpSchema = z.object({
  summary: z.string().optional(),
  timeline: z.array(z.string()).optional(),
  symptoms: z.array(z.string()).optional(),
  suspectedTrigger: z.array(z.string()).optional(),
  admissionReason: z.array(z.string()).optional(),
});

const rosHpSchema = z.object({
  summary: z.string().optional(),
});

const assessmentPlanHpSchema = z.object({
  problems: z.array(
    z.object({
      diagnosis: z.string(),
      qualifiers: z.array(z.string()).optional(),
      planItems: z.array(z.string()),
    }),
  ),
});

const encounterMetadataHpSchema = z.object({
  historyExamLevel: z.string().optional(),
  medicalDecisionMakingLevel: z.string().optional(),
  severityOfCondition: z.string().optional(),
  physicianTimeMinutes: z.number().optional(),
  counselingCoordinationCare: z.boolean().optional(),
  timeNote: z.string().optional(),
});

export const parsedHPSchema = z.object({
  date: z.string().optional(),
  chiefComplaint: z.string().optional(),
  hpi: hpiHpSchema.optional(),
  reviewOfSystems: rosHpSchema.optional(),
  history: historySchema.optional(),
  vitalsigns: z.array(vitalSignSchema).optional(),
  physicalExam: physicalExamSchema.optional(),
  labResults: z.array(labResultSchema).optional(),
  ekgInterpretation: z.string().optional(),
  assessmentPlan: assessmentPlanHpSchema.optional(),
  encounterMetadata: encounterMetadataHpSchema.optional(),
  certification: z.string().optional(),
});
export type ParsedHP = z.infer<typeof parsedHPSchema>;

/** HP narrative pass when labs are extracted separately. */
export const parsedHPBodySchema = parsedHPSchema.extend({
  labResults: z.tuple([]),
});

export const labResultsWrapperSchema = z.object({
  labResults: z.array(labResultSchema),
});

export const parsedOtherNoteSchema = z.object({
  summary: z.string(),
});
export type ParsedOtherNote = z.infer<typeof parsedOtherNoteSchema>;

/** @deprecated Use ParsedOtherNote */
export type ParsedHPNote = ParsedOtherNote;

export type StructuredOutput = ParsedERNote | ParsedHP | ParsedOtherNote;

/** JSON Schema text for LLM system prompts (Zod 4 `toJSONSchema`). */
export function schemaToPromptBlock(schema: z.ZodType): string {
  return JSON.stringify(schema.toJSONSchema(), null, 2);
}

export interface CaseModel {
  _id?: string;
  title?: string;
  status: CaseStatus;

  sourceDocuments: SourceDocument[];

  isEdited: boolean;

  createdAt: string;
  updatedAt: string;
}
