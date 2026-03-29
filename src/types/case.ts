import type { ObjectId } from "mongodb";
import type {
  CaseStructuredRawData,
  CaseStructuredRawDataPersisted,
  GeneratedHpiEntry,
} from "@/models/case";

export type { CaseStructuredRawData, CaseStructuredRawDataPersisted, GeneratedHpiEntry };

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
  /** Merged HPI layer only (no duplicate per-source snapshots; use `sourceDocuments`) */
  structuredRawData?: CaseStructuredRawDataPersisted;
  /** Each successful “Generate HPI” appends `{ text, createdAt }` */
  generatedHPI?: GeneratedHpiEntry[];
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
  structuredRawData: CaseStructuredRawDataPersisted;
  generatedHPI: GeneratedHpiEntry[];
};

/** Row in the cases list */
export type CaseListItem = {
  id: string;
  title: string;
  updatedAt: Date;
};
