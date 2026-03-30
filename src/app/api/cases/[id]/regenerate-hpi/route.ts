import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { appendGeneratedHpiWithType, getCaseById } from "@/lib/cases-db";
import { regenerateHpiWithUserNotes } from "@/lib/generate-hpi-regenerate-gpt";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteCtx) {
  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  if (typeof o.originalHpiText !== "string" || !o.originalHpiText.trim()) {
    return NextResponse.json({ error: "originalHpiText is required" }, { status: 400 });
  }
  if (typeof o.improvementNotes !== "string" || !o.improvementNotes.trim()) {
    return NextResponse.json({ error: "improvementNotes is required" }, { status: 400 });
  }

  const doc = await getCaseById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const hpi = await regenerateHpiWithUserNotes(
      doc.structuredRawData.mergedForHpi,
      o.originalHpiText,
      o.improvementNotes,
      doc.mcgEvaluation,
    );
    const generatedHPI = await appendGeneratedHpiWithType(id, hpi, "regenerated");
    if (!generatedHPI) {
      return NextResponse.json({ error: "Could not save regenerated HPI" }, { status: 500 });
    }
    revalidatePath("/cases");
    revalidatePath(`/cases/${id}`);
    return NextResponse.json({ hpi, generatedHPI });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "HPI regeneration failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
