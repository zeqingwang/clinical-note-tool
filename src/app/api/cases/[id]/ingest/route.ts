import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { extractTextFromUpload } from "@/lib/extract-document-text";
import { classifyDocumentTypeWithGpt } from "@/lib/classify-document-type-gpt";
import type { ClassificationSource } from "@/lib/classify-document-type-gpt";
import { parseDocumentTypeFormOverride } from "@/lib/infer-document-type";
import { getCaseById, ingestCaseFile } from "@/lib/cases-db";
import { structureFromRawText } from "@/lib/structure-er-note";
import type { ParsedERNote, ParsedHP, ParsedOtherNote, StructuredOutput } from "@/models/case";
import type { SourceDocumentType } from "@/types/case";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

function suggestedTitleFromOutput(out: StructuredOutput, kind: SourceDocumentType): string {
  if (kind === "ER_NOTE") {
    return (out as ParsedERNote).chiefComplaint?.trim() ?? "";
  }
  if (kind === "HP_NOTE") {
    const hp = out as ParsedHP;
    return hp.chiefComplaint?.trim() ?? hp.hpi?.summary?.trim() ?? "";
  }
  return (out as ParsedOtherNote).summary?.trim() ?? "";
}

export async function POST(request: Request, context: RouteCtx) {
  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  try {
    rawText = await extractTextFromUpload(buffer, file.type, file.name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!rawText.trim()) {
    return NextResponse.json(
      { error: "No text could be extracted from this file" },
      { status: 400 },
    );
  }

  const existing = await getCaseById(id);
  const typeOverride = parseDocumentTypeFormOverride(formData.get("documentType"));

  let documentType: SourceDocumentType;
  let classificationReason: string;
  let classificationSource: ClassificationSource | "override";

  if (typeOverride) {
    documentType = typeOverride;
    classificationReason = "Explicit documentType in form data";
    classificationSource = "override";
  } else {
    const c = await classifyDocumentTypeWithGpt({
      fileName: file.name,
      caseTitle: existing?.title,
    });
    documentType = c.type;
    classificationReason = c.reason;
    classificationSource = c.source;
  }

  let structuredOutput: StructuredOutput;
  try {
    structuredOutput = await structureFromRawText(rawText, documentType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Structuring failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const suggested = suggestedTitleFromOutput(structuredOutput, documentType);
  const title =
    !existing?.title?.trim() && suggested ? suggested.slice(0, 200) : undefined;

  const ok = await ingestCaseFile(id, {
    fileName: file.name,
    structuredOutput,
    title,
    type: documentType,
  });
  if (!ok) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const updated = await getCaseById(id);

  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);

  return NextResponse.json({
    sourceDocuments: updated?.sourceDocuments ?? [],
    titleApplied: Boolean(title),
    documentType,
    classificationReason,
    classificationSource,
  });
}
