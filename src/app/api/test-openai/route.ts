import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function GET() {
  try {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
      return NextResponse.json(
        { ok: false, error: 'Missing environment variable "OPENAI_API_KEY"' },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey: key });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Respond with exactly: pong" },
        { role: "user", content: "ping" },
      ],
      temperature: 0,
      max_completion_tokens: 8,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ ok: true, model, text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

