import { NextResponse } from "next/server";

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

    const { structureMcgFromRawText } = await import("@/lib/structure-mcg-gpt");

    const sample = `
DKA admission criteria:
pH < 7.30
bicarbonate <= 18
Ketones positive
Glucose any or >200 depending

Inpatient indicators:
pH <= 7.25
bicarbonate < 15
Altered mental status
Persistent dehydration
Electrolyte abnormality
Unable to tolerate PO
IV insulin required

Risk factors:
SGLT2 inhibitor
Infection
Starvation
Pregnancy
`;

    const criteria = await structureMcgFromRawText(sample);
    return NextResponse.json({ ok: true, keys: Object.keys(criteria), criteria }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

