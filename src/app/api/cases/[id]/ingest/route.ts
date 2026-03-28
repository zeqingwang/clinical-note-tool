import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { extractTextFromUpload } from "@/lib/extract-document-text";
import { getCaseById, ingestCaseFile } from "@/lib/cases-db";
import { structureErNoteFromRawText } from "@/lib/structure-er-note";
import type { ParsedERNote } from "@/models/case";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

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

  let structuredOutput: ParsedERNote;
  try {
    structuredOutput = await structureErNoteFromRawText(rawText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Structuring failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const existing = await getCaseById(id);
  const chief = structuredOutput.chiefComplaint?.trim() ?? "";
  const title =
    !existing?.title?.trim() && chief ? chief.slice(0, 200) : undefined;

  const ok = await ingestCaseFile(id, { rawText, structuredOutput, title });
  if (!ok) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);

  return NextResponse.json({
    rawText,
    structuredOutput,
    titleApplied: Boolean(title),
  });
}
