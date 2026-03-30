import OpenAI from "openai";
import type { McgEvaluation, MergedForHpi } from "@/models/case";
import {
  buildHpiStructuredInputFromMerged,
  mergedForHpiToSummaryMarkdown,
} from "@/lib/generate-hpi-from-summary-gpt";

const REGENERATE_SYSTEM = `You are an attending physician revising a History of Present Illness (HPI) for a hospital chart.

You receive four blocks:

1) structuredInput: JSON typed as HpiStructuredInput. Fields may be incomplete.

2) clinicalSummaryMarkdown: merged clinical summary from source documents. This is the primary source of truth.

3) mcgEvaluation: payer / MCG readiness evaluation computed from the structured clinical layer.

4) originalHpi: the current HPI narrative to improve.

5) userRegenerationNotes: author instructions as markdown with optional sections: "Missing or thin points to address", "Inconsistencies to resolve", "Suggested improvements (from review)", and "Custom instructions from author". Honor each section when rewriting.

Task:
Rewrite the HPI as ONE cohesive narrative that addresses userRegenerationNotes while staying faithful to clinicalSummaryMarkdown and structuredInput.

Rules:
- Fully rewrite the HPI from scratch; do not lightly edit or partially paraphrase the original.
- Prioritize clinicalSummaryMarkdown as the source of truth; resolve conflicts in its favor.
- Do NOT invent facts not supported by the inputs.
- If userRegenerationNotes conflict with clinical facts, ignore the conflicting instruction and preserve accuracy.

Clinical writing requirements:
- Begin with patient context and chief complaint.
- Present a clear chronological symptom timeline.
- Include pertinent positives and relevant negatives when available.
- Incorporate key objective findings (exam, vitals, labs) that support the diagnosis.
- Explicitly link findings to the diagnosis using phrasing such as "findings consistent with..." or "clinical picture consistent with...".
- Do NOT state that labs directly "show" or "diagnose" a condition.

- MUST include ED treatments already administered (e.g., fluids, insulin infusion), written in past tense.
- Do NOT describe only planned or future treatments.

- Reflect severity using objective indicators (e.g., severe acidosis, need for continuous IV therapy).
- End with a strong admission rationale, clearly justifying inpatient or ICU-level care.
- When appropriate, contrast with why discharge or observation would not be sufficient.

Style:
- Formal physician-level clinical prose.
- Paragraphs only (no JSON, no bullet lists).
- Avoid redundancy and unnecessary full normal exam descriptions.
- Exclude details that do not support diagnosis, severity, or admission.

Structure:
context → timeline → key findings → diagnosis → ED course → severity → admission justification

Output:
Write only the revised HPI narrative body.`;

export async function regenerateHpiWithUserNotes(
  merged: MergedForHpi,
  originalHpiText: string,
  improvementNotes: string,
  mcgEvaluation: McgEvaluation,
): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const structuredInput = buildHpiStructuredInputFromMerged(merged);
  const clinicalSummaryMarkdown = mergedForHpiToSummaryMarkdown(merged);
  const user = `structuredInput:\n${JSON.stringify(structuredInput, null, 2)}\n\n---\n\nclinicalSummaryMarkdown:\n${clinicalSummaryMarkdown}\n\n---\n\nmcgEvaluation (payer / MCG readiness):\n${JSON.stringify(mcgEvaluation, null, 2)}\n\n---\n\noriginalHpi:\n${originalHpiText.trim()}\n\n---\n\nuserRegenerationNotes:\n${improvementNotes.trim()}`;

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: REGENERATE_SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.35,
    max_completion_tokens: 4096,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty regenerated HPI response from model");
  }
  return text;
}
