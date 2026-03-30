import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cwd = process.cwd();
    const workerPath = path.join(
      cwd,
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs",
    );

    const exists = fs.existsSync(workerPath);

    // Robust check (works even if cwd changes)
    let resolved: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      resolved = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    } catch {
      resolved = null;
    }

    return NextResponse.json({
      ok: true,
      cwd,
      workerPath,
      exists,
      workerUrl: exists ? pathToFileURL(workerPath).href : null,
      resolved,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

