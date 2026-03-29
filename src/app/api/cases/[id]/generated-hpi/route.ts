import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { deleteGeneratedHpiEntry } from "@/lib/cases-db";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function DELETE(request: Request, context: RouteCtx) {
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

  const generatedHPI = await deleteGeneratedHpiEntry(id, {
    createdAt: o.createdAt,
    text: o.text,
  });
  if (!generatedHPI) {
    return NextResponse.json({ error: "Not found or could not update" }, { status: 404 });
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);
  return NextResponse.json({ generatedHPI });
}
