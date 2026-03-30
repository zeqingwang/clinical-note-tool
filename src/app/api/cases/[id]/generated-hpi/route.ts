import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  appendGeneratedHpiWithType,
  deleteGeneratedHpiEntry,
  updateGeneratedHpiAsHumanRevise,
} from "@/lib/cases-db";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteCtx) {
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
  if (typeof o.newText !== "string" || !o.newText.trim()) {
    return NextResponse.json({ error: "newText is required" }, { status: 400 });
  }
  if (typeof o.mode !== "string" || (o.mode !== "new" && o.mode !== "update")) {
    return NextResponse.json({ error: "mode must be 'new' or 'update'" }, { status: 400 });
  }

  let generatedHPI = null;
  if (o.mode === "new") {
    generatedHPI = await appendGeneratedHpiWithType(id, o.newText, "human_revise");
  } else {
    if (typeof o.createdAt !== "string" || !o.createdAt.trim()) {
      return NextResponse.json({ error: "createdAt is required for update mode" }, { status: 400 });
    }
    if (typeof o.text !== "string") {
      return NextResponse.json({ error: "text is required for update mode" }, { status: 400 });
    }
    generatedHPI = await updateGeneratedHpiAsHumanRevise(
      id,
      { createdAt: o.createdAt, text: o.text },
      o.newText,
    );
  }

  if (!generatedHPI) {
    return NextResponse.json({ error: "Could not update generatedHPI" }, { status: 404 });
  }

  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);
  return NextResponse.json({ generatedHPI });
}

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
