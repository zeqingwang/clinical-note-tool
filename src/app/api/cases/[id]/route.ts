import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { deleteCase, getCaseById, updateCase } from "@/lib/cases-db";
import { caseEditableFieldsSchema } from "@/models/case";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteCtx) {
  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const doc = await getCaseById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
}

export async function PATCH(request: Request, context: RouteCtx) {
  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = caseEditableFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const ok = await updateCase(id, parsed.data);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteCtx) {
  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const ok = await deleteCase(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  revalidatePath("/cases");

  return NextResponse.json({ ok: true });
}
