import type { ObjectId } from "mongodb";

/** User-editable fields (forms, API body, updates) */
export type CaseEditableFields = {
  title: string;
  content: string;
};

/** Full document shape stored in MongoDB (without _id) */
export type CaseStoredFields = CaseEditableFields & {
  createdAt: Date;
  updatedAt: Date;
  /** Plain text extracted from an uploaded note (PDF/DOCX/TXT) */
  rawText?: string;
  /** GPT-parsed ER note — shape matches `ParsedERNote` in `@/models/case` */
  structuredOutput?: unknown;
};

/** Document as returned from MongoDB */
export type CaseDocument = CaseStoredFields & {
  _id: ObjectId;
};

/** Single case in the edit/detail view */
export type CaseDetail = CaseEditableFields & {
  id: string;
  updatedAt: Date;
  rawText?: string;
  structuredOutput?: unknown;
};

/** Row in the cases list */
export type CaseListItem = {
  id: string;
  title: string;
  updatedAt: Date;
};
