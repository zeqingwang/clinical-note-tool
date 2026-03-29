import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { appendGeneratedHpi, getCaseById } from "@/lib/cases-db";
import { generateHpiNaturalLanguageFromMerged } from "@/lib/generate-hpi-from-summary-gpt";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteCtx) {
  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const doc = await getCaseById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const hpi = await generateHpiNaturalLanguageFromMerged(doc.structuredRawData.mergedForHpi);
    const generatedHPI = await appendGeneratedHpi(id, hpi);
    if (!generatedHPI) {
      return NextResponse.json({ error: "Could not save generated HPI" }, { status: 500 });
    }
    revalidatePath("/cases");
    revalidatePath(`/cases/${id}`);
    return NextResponse.json({ hpi, generatedHPI });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "HPI generation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
