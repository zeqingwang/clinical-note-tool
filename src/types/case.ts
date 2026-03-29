import type { ObjectId } from "mongodb";
import type { CaseStructuredRawData } from "@/models/case";

export type { CaseStructuredRawData };

export type SourceDocumentType = "ER_NOTE" | "HP_NOTE" | "OTHER";

/** One uploaded file’s structured parse (raw text is not stored). */
export interface SourceDocument {
  type: SourceDocumentType;
  fileName?: string;
  /** Matches `StructuredOutput` / `ParsedERNote` from `@/models/case` */
  structuredOutput: unknown;
}

/** User-editable fields (forms, API body, updates) */
export type CaseEditableFields = {
  title: string;
  content: string;
};

/** Full document shape stored in MongoDB (without _id) */
export type CaseStoredFields = CaseEditableFields & {
  createdAt: Date;
  updatedAt: Date;
  sourceDocuments: SourceDocument[];
  /** Denormalized HPI-oriented aggregate; rebuilt when sources change */
  structuredRawData?: CaseStructuredRawData;
};

/** Document as returned from MongoDB */
export type CaseDocument = CaseStoredFields & {
  _id: ObjectId;
};

/** Single case in the edit/detail view */
export type CaseDetail = CaseEditableFields & {
  id: string;
  updatedAt: Date;
  sourceDocuments: SourceDocument[];
  structuredRawData: CaseStructuredRawData;
};

/** Row in the cases list */
export type CaseListItem = {
  id: string;
  title: string;
  updatedAt: Date;
};
