import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const mongodbUri = process.env.MONGODB_URI;
    if (!mongodbUri || !mongodbUri.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing environment variable "MONGODB_URI"',
        },
        { status: 500 },
      );
    }

    // Important: dynamic import so module-load errors are catchable.
    const mod = await import("@/lib/mongodb");
    const clientPromise = mod.default as Promise<import("mongodb").MongoClient>;

    const client = await clientPromise;
    const dbName = process.env.MONGODB_DB?.trim() || "test";
    const db = client.db(dbName);

    await db.command({ ping: 1 });

    return NextResponse.json({ ok: true, dbName });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
      },
      { status: 500 },
    );
  }
}

