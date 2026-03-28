import { z } from "zod";
import type { CaseEditableFields, CaseStoredFields } from "@/types/case";

export const CASE_COLLECTION = "cases" as const;

/** Fields persisted on every case document */
export const caseStoredFieldsSchema: z.ZodType<CaseStoredFields> = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** User-editable fields (form / API body) */
export const caseEditableFieldsSchema: z.ZodType<CaseEditableFields> = z.object({
  title: z.string(),
  content: z.string(),
});

export type {
  CaseDetail,
  CaseDocument,
  CaseEditableFields,
  CaseListItem,
  CaseStoredFields,
} from "@/types/case";

export function createDraftCaseRecord(now: Date = new Date()): CaseStoredFields {
  return caseStoredFieldsSchema.parse({
    title: "",
    content: "",
    createdAt: now,
    updatedAt: now,
  });
}
