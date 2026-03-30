import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { extractTextFromUpload } from "@/lib/extract-document-text";
import { insertMcgDocument } from "@/lib/mcg-db";
import { structureMcgFromRawText } from "@/lib/structure-mcg-gpt";

export const runtime = "nodejs";

function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^/.]+$/, "").trim();
  return base || "MCG upload";
}

export async function POST(request: Request) {
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

  try {
    const criteria = await structureMcgFromRawText(rawText);
    const id = await insertMcgDocument({
      title: titleFromFileName(file.name),
      sourceFileName: file.name,
      criteria,
    });
    revalidatePath("/mcg");
    revalidatePath(`/mcg/${id}`);
    return NextResponse.json({ id, diseaseKeys: Object.keys(criteria) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "MCG structuring failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
