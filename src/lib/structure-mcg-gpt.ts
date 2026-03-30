import OpenAI from "openai";
import { mcgCriteriaSchema, type MCGCriteria } from "@/models/mcg";

const MCG_STRUCTURE_SYSTEM = `You extract Milliman Care Guidelines (MCG)–style medical necessity criteria from clinical guideline or policy text.

Output ONE JSON object only (no markdown). Top-level keys are disease or pathway identifiers in camelCase (e.g. "dkaAdmission", "acuteAsthmaExacerbation"). Each value MUST have exactly this shape:

{
  "diagnosisCriteria": { "<criterionName>": <string | number | boolean> },
  "inpatientIndicators": [ "string", ... ],
  "riskFactors": [ "string", ... ]
}

Rules:
- diagnosisCriteria: map human-readable labels (camelCase keys preferred, e.g. "pH", "bicarbonate", "ketones", "glucose") to string thresholds ("< 7.30"), plain numbers if numeric, or boolean when the text states presence/absence (e.g. ketones positive).
- inpatientIndicators: bullet-style indications for inpatient care from the document.
- riskFactors: associated risk factors or precipitants listed in the document.
- If the text describes multiple distinct diseases/conditions, use multiple top-level keys.
- Preserve wording from the source where it encodes thresholds; do not invent criteria not supported by the text.
- If a section is absent in the source, use an empty object for diagnosisCriteria and empty arrays for lists.

Example shape (structure only; do not copy values unless in source):
{
  "dkaAdmission": {
    "diagnosisCriteria": { "pH": "< 7.30", "bicarbonate": "<= 18", "ketones": true },
    "inpatientIndicators": ["pH <= 7.25", "..."],
    "riskFactors": ["SGLT2 inhibitor", "..."]
  }
}`;

export async function structureMcgFromRawText(rawText: string): Promise<MCGCriteria> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("No text to structure");
  }

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: MCG_STRUCTURE_SYSTEM },
      {
        role: "user",
        content: `Extract MCG-style criteria from the following document text:\n\n${trimmed.slice(0, 120_000)}`,
      },
    ],
    temperature: 0.2,
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Empty MCG structure response from model");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("MCG response was not valid JSON");
  }

  const out = mcgCriteriaSchema.safeParse(parsed);
  if (!out.success) {
    throw new Error("MCG JSON did not match expected criteria shape");
  }

  if (Object.keys(out.data).length === 0) {
    throw new Error("Model returned no disease blocks; try a guideline document with clear criteria");
  }

  return out.data;
}
