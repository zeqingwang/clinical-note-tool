import { ObjectId, type Document, type UpdateFilter } from "mongodb";
import clientPromise from "@/lib/mongodb";
import {
  normalizeStructuredRawData,
  rebuildStructuredRawDataFromDocuments,
} from "@/lib/structured-raw-data";
import {
  CASE_COLLECTION,
  caseEditableFieldsSchema,
  createDraftCaseRecord,
} from "@/models/case";
import type { StructuredOutput } from "@/models/case";
import type {
  CaseDetail,
  CaseEditableFields,
  CaseListItem,
  SourceDocument,
  SourceDocumentType,
} from "@/types/case";

function dbName() {
  return process.env.MONGODB_DB?.trim() || undefined;
}

export type { CaseDetail, CaseListItem };

export async function insertDraftCase(): Promise<string> {
  const client = await clientPromise;
  const db = client.db(dbName());
  const now = new Date();
  const doc = createDraftCaseRecord(now);
  const { insertedId } = await db.collection(CASE_COLLECTION).insertOne(doc);
  return insertedId.toHexString();
}

export async function listCases(): Promise<CaseListItem[]> {
  const client = await clientPromise;
  const db = client.db(dbName());
  const docs = await db
    .collection(CASE_COLLECTION)
    .find({})
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray();

  return docs.map((d) => ({
    id: (d._id as ObjectId).toHexString(),
    title: typeof d.title === "string" && d.title.trim() ? d.title : "Untitled",
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt : new Date(0),
  }));
}

function normalizeSourceDocuments(doc: Document): SourceDocument[] {
  if (Array.isArray(doc.sourceDocuments) && doc.sourceDocuments.length > 0) {
    return doc.sourceDocuments.filter(
      (item): item is SourceDocument =>
        item != null &&
        typeof item === "object" &&
        "type" in item &&
        "structuredOutput" in item,
    );
  }
  if (doc.structuredOutput != null) {
    return [
      {
        type: "ER_NOTE",
        fileName: "Legacy (root structuredOutput)",
        structuredOutput: doc.structuredOutput,
      },
    ];
  }
  return [];
}

export async function getCaseById(id: string): Promise<CaseDetail | null> {
  if (!ObjectId.isValid(id)) return null;
  const client = await clientPromise;
  const db = client.db(dbName());
  const doc = (await db
    .collection(CASE_COLLECTION)
    .findOne({ _id: new ObjectId(id) })) as Document | null;
  if (!doc) return null;
  return {
    id: (doc._id as ObjectId).toHexString(),
    title: typeof doc.title === "string" ? doc.title : "",
    content: typeof doc.content === "string" ? doc.content : "",
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(0),
    sourceDocuments: normalizeSourceDocuments(doc),
    structuredRawData: normalizeStructuredRawData(doc.structuredRawData),
  };
}

export async function ingestCaseFile(
  id: string,
  data: {
    fileName: string;
    structuredOutput: StructuredOutput;
    title?: string;
    type: SourceDocumentType;
  },
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const client = await clientPromise;
  const db = client.db(dbName());

  const entry = {
    type: data.type,
    fileName: data.fileName,
    structuredOutput: data.structuredOutput,
  };

  const $set: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (data.title !== undefined) {
    $set.title = data.title;
  }

  const update = {
    $push: { sourceDocuments: entry },
    $set,
    $unset: { rawText: "", structuredOutput: "" },
  } as unknown as UpdateFilter<Document>;

  const result = await db.collection(CASE_COLLECTION).updateOne({ _id: new ObjectId(id) }, update);
  if (result.matchedCount === 0) return false;

  const after = (await db
    .collection(CASE_COLLECTION)
    .findOne({ _id: new ObjectId(id) })) as Document | null;
  if (!after) return false;

  const structuredRawData = rebuildStructuredRawDataFromDocuments(
    normalizeSourceDocuments(after),
    after.updatedAt instanceof Date ? after.updatedAt : new Date(),
  );
  await db.collection(CASE_COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: { structuredRawData } },
  );
  return true;
}

export async function updateCase(id: string, data: CaseEditableFields): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const { title, content } = caseEditableFieldsSchema.parse(data);
  const client = await clientPromise;
  const db = client.db(dbName());
  const result = await db.collection(CASE_COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        title,
        content,
        updatedAt: new Date(),
      },
    },
  );
  return result.matchedCount > 0;
}

export async function deleteCase(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const client = await clientPromise;
  const db = client.db(dbName());
  const result = await db.collection(CASE_COLLECTION).deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

/** Remove one entry from the case’s `sourceDocuments` (same ordering as `getCaseById`). */
export async function removeSourceDocumentAtIndex(caseId: string, index: number): Promise<boolean> {
  if (!ObjectId.isValid(caseId)) return false;
  if (!Number.isInteger(index) || index < 0) return false;
  const client = await clientPromise;
  const db = client.db(dbName());
  const doc = (await db
    .collection(CASE_COLLECTION)
    .findOne({ _id: new ObjectId(caseId) })) as Document | null;
  if (!doc) return false;

  const normalized = normalizeSourceDocuments(doc);
  if (index >= normalized.length) return false;
  normalized.splice(index, 1);

  const updatedAt = new Date();
  const structuredRawData = rebuildStructuredRawDataFromDocuments(normalized, updatedAt);

  const update: UpdateFilter<Document> = {
    $set: {
      sourceDocuments: normalized,
      updatedAt,
      structuredRawData,
    },
  };
  if (normalized.length === 0) {
    update.$unset = { structuredOutput: "" };
  }

  const result = await db.collection(CASE_COLLECTION).updateOne({ _id: new ObjectId(caseId) }, update);
  return result.matchedCount > 0;
}
