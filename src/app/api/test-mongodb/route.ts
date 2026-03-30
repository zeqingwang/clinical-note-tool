import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const client = await clientPromise;
    const dbName = process.env.MONGODB_DB?.trim() || "test";
    const db = client.db(dbName);

    // Lightweight connectivity test
    await db.command({ ping: 1 });

    return NextResponse.json({
      ok: true,
      dbName,
    });
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

