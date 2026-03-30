import { ObjectId, type Document } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { MCG_COLLECTION, mcgCriteriaSchema, type MCGCriteria } from "@/models/mcg";

function dbName() {
  return process.env.MONGODB_DB?.trim() || undefined;
}

export type McgListItem = {
  id: string;
  title: string;
  sourceFileName: string;
  updatedAt: Date;
  diseaseKeys: string[];
};

export type McgDetail = McgListItem & {
  criteria: MCGCriteria;
};

function normalizeCriteria(raw: unknown): MCGCriteria | null {
  const p = mcgCriteriaSchema.safeParse(raw);
  return p.success ? p.data : null;
}

export async function insertMcgDocument(data: {
  title: string;
  sourceFileName: string;
  criteria: MCGCriteria;
}): Promise<string> {
  const client = await clientPromise;
  const db = client.db(dbName());
  const now = new Date();
  const { insertedId } = await db.collection(MCG_COLLECTION).insertOne({
    title: data.title,
    sourceFileName: data.sourceFileName,
    criteria: data.criteria,
    createdAt: now,
    updatedAt: now,
  });
  return insertedId.toHexString();
}

export async function listMcgDocuments(): Promise<McgListItem[]> {
  const client = await clientPromise;
  const db = client.db(dbName());
  const docs = await db
    .collection(MCG_COLLECTION)
    .find({})
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray();

  return docs.map((d) => {
    const id = (d._id as ObjectId).toHexString();
    const criteria = normalizeCriteria(d.criteria) ?? {};
    return {
      id,
      title: typeof d.title === "string" && d.title.trim() ? d.title : "Untitled MCG",
      sourceFileName: typeof d.sourceFileName === "string" ? d.sourceFileName : "",
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt : new Date(0),
      diseaseKeys: Object.keys(criteria),
    };
  });
}

export async function getMcgById(id: string): Promise<McgDetail | null> {
  if (!ObjectId.isValid(id)) return null;
  const client = await clientPromise;
  const db = client.db(dbName());
  const d = (await db.collection(MCG_COLLECTION).findOne({ _id: new ObjectId(id) })) as Document | null;
  if (!d) return null;

  const criteria = normalizeCriteria(d.criteria);
  if (!criteria) return null;

  return {
    id: (d._id as ObjectId).toHexString(),
    title: typeof d.title === "string" && d.title.trim() ? d.title : "Untitled MCG",
    sourceFileName: typeof d.sourceFileName === "string" ? d.sourceFileName : "",
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt : new Date(0),
    diseaseKeys: Object.keys(criteria),
    criteria,
  };
}

export async function deleteMcg(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const client = await clientPromise;
  const db = client.db(dbName());
  const result = await db.collection(MCG_COLLECTION).deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
