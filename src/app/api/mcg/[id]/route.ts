import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { deleteMcg, getMcgById } from "@/lib/mcg-db";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteCtx) {
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const doc = await getMcgById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    sourceFileName: doc.sourceFileName,
    updatedAt: doc.updatedAt.toISOString(),
    diseaseKeys: doc.diseaseKeys,
    criteria: doc.criteria,
  });
}

export async function DELETE(_request: Request, context: RouteCtx) {
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const ok = await deleteMcg(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidatePath("/mcg");
  revalidatePath(`/mcg/${id}`);
  return NextResponse.json({ ok: true });
}
