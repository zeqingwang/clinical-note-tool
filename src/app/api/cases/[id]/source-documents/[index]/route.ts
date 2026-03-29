import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCaseById, removeSourceDocumentAtIndex } from "@/lib/cases-db";

type RouteCtx = { params: Promise<{ id: string; index: string }> };

function parseIndexParam(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (n < 0 || n > Number.MAX_SAFE_INTEGER) return null;
  return n;
}

export async function DELETE(_request: Request, context: RouteCtx) {
  const { id, index: indexStr } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const index = parseIndexParam(indexStr);
  if (index === null) {
    return NextResponse.json({ error: "Invalid index" }, { status: 400 });
  }

  const detail = await getCaseById(id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (index >= detail.sourceDocuments.length) {
    return NextResponse.json({ error: "Invalid index" }, { status: 400 });
  }

  const ok = await removeSourceDocumentAtIndex(id, index);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);

  return NextResponse.json({ ok: true });
}
