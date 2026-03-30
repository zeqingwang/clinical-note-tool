import { NextResponse } from "next/server";
import { listMcgDocuments } from "@/lib/mcg-db";

export const runtime = "nodejs";

export async function GET() {
  const items = await listMcgDocuments();
  return NextResponse.json(
    items.map((r) => ({
      id: r.id,
      title: r.title,
      sourceFileName: r.sourceFileName,
      updatedAt: r.updatedAt.toISOString(),
      diseaseKeys: r.diseaseKeys,
    })),
  );
}
