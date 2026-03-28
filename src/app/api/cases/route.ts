import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { insertDraftCase, listCases } from "@/lib/cases-db";

export async function GET() {
  const items = await listCases();
  return NextResponse.json(items);
}

export async function POST() {
  const id = await insertDraftCase();
  revalidatePath("/cases");
  return NextResponse.json({ id }, { status: 201 });
}
