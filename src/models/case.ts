import { z } from "zod";
import type { CaseEditableFields, CaseStoredFields, SourceDocument } from "@/types/case";

export const CASE_COLLECTION = "cases" as const;

const sourceDocumentSchema = z.object({
  type: z.enum(["ER_NOTE", "HP_NOTE", "OTHER"]),
  fileName: z.string().optional(),
  structuredOutput: z.unknown(),
});

/** Fields persisted on every case document */
export const caseStoredFieldsSchema: z.ZodType<CaseStoredFields> = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  sourceDocuments: z.array(sourceDocumentSchema),
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
 * One row from “Vital Signs: This Visit” (matches typical EMR columns).
 * Most fields are optional because rows are often partially blank.
 */
export interface VitalSign {
  /** Date/time of this set (ISO string or EMR display, e.g. "02/08/2026 15:00") */
  dateTime: string;
  /** Blood pressure, e.g. "105/67" */
  bpMmHg?: string;
  /** e.g. "Lying/Right Arm" */
  bpPosition?: string;
  /** Mean arterial pressure */
  mapMmHg?: number;
  heartRate?: number;
  pulseSite?: string;
  /** Respiratory rate */
  respirationRate?: number;
  tempCelsius?: number;
  tempFahrenheit?: number;
  /** SpO₂ (%) */
  spo2Percent?: number;
  /** O₂ flow (L/min) */
  o2LitersPerMin?: number;
  /** FiO₂ (fraction or % per source system) */
  fio2?: string | number;
  /** End-tidal CO₂ (mmHg) */
  etco2MmHg?: number;
  /** e.g. "Room Air 21%" */
  o2Device?: string;
  bloodSugar?: string | number;
  painScore?: string | number;
  heightInches?: number;
  heightCm?: number;
  weightKg?: number;
  /** Combined lbs/oz display when provided by EMR */
  weightLbsOz?: string;
  scale?: string;
  bmi?: number;
  /** Body surface area */
  bsa?: number;
  headCircumferenceCm?: number;
}
/**
 * Physical exam by system (typical ER narrative template).
 * Each field holds free text for that heading (may be empty if not examined).
 */
export interface PhysicalExam {
  generalAppearance: string;
  heent: string;
  neck: string;
  lungs: string;
  /** Auscultation, heart sounds, peripheral pulses / cap refill / turgor as one block */
  heart: string;
  abdomen: string;
  extremities: string;
  neurologic: string;
  vascular: string;
  skin: string;
  /** Mentation / psychiatric (e.g. alert, oriented, affect) */
  psych: string;
}
export interface LabResult {
  testName: string;
  result: string | number;
  units: string;
  referenceRange: string;
  isAbnormal: boolean;
}

/** Critical care / time-based documentation (when applicable) */
export interface CriticalCareTimeNote {
  minutes?: number;
  /** Full prose for billing context (interventions, discussions, exclusions) */
  narrative: string;
}

/**
 * MEDICAL DECISION / PROCEDURES / ER COURSE — structured buckets; use `fullNarrative`
 * for a single pasted block if you do not split the source.
 */
export interface MedicalDecisionErCourse {
  /** e.g. room placement, evaluated immediately, reassessment cadence */
  evaluationAndMonitoring?: string;
  /** Presentation as framed in MDM (demographics, vitals, pertinent exam) */
  presentationRecap?: string;
  /** Differential and clinical reasoning (may include “not limited to…”, what-ifs ruled out) */
  differentialAndReasoning?: string;
  /** Labs, imaging, ABG, troponin, etc. */
  dataReviewAndStudies?: string;
  /** ED therapeutics (fluids, meds, drips) and response framing */
  interventionsAndManagement?: string;
  /** Consultations, handoffs, admissions discussions */
  consultations?: string;
  criticalCareTime?: CriticalCareTimeNote;
  /** Optional: entire section as one string from EMR export */
  fullNarrative?: string;
}



export interface ParsedERNote {
  chiefComplaint: string;
  hpiSummary: string;
  /** Past Medical History */
  pastMedicalHistory: string;
  /** Past Surgical History */
  pastSurgicalHistory: string;
  familyHistory: string;
  allergies: string;
  medications: string;
  /** Social history (SHx) */
  socialHistory: string;
  /** Review of Systems (ROS) — e.g. pertinent positives/negatives in HPI; remaining systems negative */
  ROS: string;
  /** Vital signs for this visit (one or more EMR rows) */
  vitalsigns: VitalSign[];
  physicalExam: PhysicalExam;
  labResults: LabResult[];
  medicalDecisionErCourse: MedicalDecisionErCourse;

  clinicalImpression: string[];
  condition: string;
  disposition: string;



}
export interface ParsedHPNote {
  summary: string;
}

export type StructuredOutput = ParsedERNote | ParsedHPNote;

export interface CaseModel {
  _id?: string;
  title?: string;
  status: CaseStatus;

  sourceDocuments: SourceDocument[];

  // generatedOutput?: StructuredOutput;
  // editedOutput?: StructuredOutput;

  isEdited: boolean;

  createdAt: string;
  updatedAt: string;
}
