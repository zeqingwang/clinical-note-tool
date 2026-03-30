import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { insertDraftCase, listCases } from "@/lib/cases-db";

export async function GET() {
  try {
    const items = await listCases();
    return NextResponse.json(items);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    // Useful for Amplify debugging: surfaces server-side failure reason to the client.
    console.error("GET /api/cases failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  const id = await insertDraftCase();
  revalidatePath("/cases");
  return NextResponse.json({ id }, { status: 201 });
}
