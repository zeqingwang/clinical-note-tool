import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCaseById, setGeneratedHpiReview } from "@/lib/cases-db";
import { generateHpiInsuranceReview } from "@/lib/generate-hpi-review-gpt";

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
  if (typeof o.createdAt !== "string" || !o.createdAt.trim()) {
    return NextResponse.json({ error: "createdAt is required" }, { status: 400 });
  }
  if (typeof o.text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const doc = await getCaseById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await generateHpiInsuranceReview(doc.structuredRawData.mergedForHpi, o.text);
    const reviewGeneratedAt = new Date().toISOString();
    const generatedHPI = await setGeneratedHpiReview(
      id,
      { createdAt: o.createdAt, text: o.text },
      {
        score: result.score,
        improvement: result.improvement,
        reviewGeneratedAt,
      },
    );
    if (!generatedHPI) {
      return NextResponse.json(
        { error: "Could not update HPI entry (check createdAt/text match)" },
        { status: 404 },
      );
    }
    revalidatePath("/cases");
    revalidatePath(`/cases/${id}`);
    return NextResponse.json({ generatedHPI });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Review generation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
