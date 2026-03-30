import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { runAutoHpiLoopInMemory } from "@/lib/auto-hpi-loop";
import { appendGeneratedHpi, getCaseById } from "@/lib/cases-db";

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
    const hpi = await runAutoHpiLoopInMemory(doc.structuredRawData.mergedForHpi);
    const generatedHPI = await appendGeneratedHpi(id, hpi);
    if (!generatedHPI) {
      return NextResponse.json({ error: "Could not save HPI" }, { status: 500 });
    }
    revalidatePath("/cases");
    revalidatePath(`/cases/${id}`);
    return NextResponse.json({ hpi, generatedHPI });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auto HPI loop failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
