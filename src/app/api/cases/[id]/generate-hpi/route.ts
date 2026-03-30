import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { appendGeneratedHpi, getCaseById } from "@/lib/cases-db";
import {
  generateHpiNaturalLanguageFromMerged,
  type GenerateHpiCandidateVariant,
} from "@/lib/generate-hpi-from-summary-gpt";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteCtx) {
  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let candidateVariant: GenerateHpiCandidateVariant | undefined;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { candidateVariant?: unknown };
      if (body.candidateVariant === 1 || body.candidateVariant === 2) {
        candidateVariant = body.candidateVariant;
      }
    } catch {
      /* empty body ok */
    }
  }

  const doc = await getCaseById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const hpi = await generateHpiNaturalLanguageFromMerged(doc.structuredRawData.mergedForHpi, {
      candidateVariant,
      mcgEvaluation: doc.mcgEvaluation,
    });
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
