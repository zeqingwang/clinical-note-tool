import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    await import("@/lib/extract-document-text");
    results.extractDocumentTextImport = "ok";
  } catch (e) {
    results.extractDocumentTextImport = e instanceof Error ? e.message : String(e);
  }

  try {
    await import("@/lib/structure-mcg-gpt");
    results.structureMcgImport = "ok";
  } catch (e) {
    results.structureMcgImport = e instanceof Error ? e.message : String(e);
  }

  const ok = Object.values(results).every((v) => v === "ok");

  return NextResponse.json(
    {
      ok,
      results,
    },
    ok ? { status: 200 } : { status: 500 },
  );
}

