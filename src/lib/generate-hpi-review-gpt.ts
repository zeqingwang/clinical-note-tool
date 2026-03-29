import OpenAI from "openai";
import { mergedForHpiToSummaryMarkdown } from "@/lib/generate-hpi-from-summary-gpt";
import { generatedHpiScoreSchema, type GeneratedHpiScore, type MergedForHpi } from "@/models/case";

const REVIEW_SYSTEM = `You are a clinical documentation and utilization management (UM) advisor helping ensure a History of Present Illness (HPI) will stand up to payer / insurance medical necessity review and is less likely to be denied for insufficient documentation.

You receive:
1) clinicalSummaryMarkdown — merged source-of-truth clinical summary from the chart.
2) hpiText — the drafted HPI narrative submitted for review (e.g. for admission or continued stay).

Your tasks:
- Score overall documentation quality for payer review on a 0–100 scale.
- Write a concise summary (2–4 sentences) explaining denial risk, completeness, and alignment with the summary.
- List specific missing clinical points that payers or reviewers often expect in the HPI when absent or underdeveloped.
- Flag inconsistencies INTERNAL to the HPI or BETWEEN the HPI and the clinical summary.
- Provide actionable improvement guidance to reduce denial risk and strengthen medical necessity documentation.

Scoring rubric (total = 100):
- Factual accuracy & consistency (0–25)
- Chronology & clarity (0–15)
- Diagnostic reasoning (linking findings to diagnosis) (0–20)
- ED course completeness (treatments already given) (0–15)
- Admission / medical necessity justification (0–20)
- Conciseness & relevance (0–5)

Evaluation rules:
- Treat clinicalSummaryMarkdown as the source of truth.
- Do NOT invent patient facts.
- Identify key facts present in the summary but missing or under-emphasized in the HPI.
- Explicitly check for:
  - diagnosis–lab mismatches (e.g., euglycemic DKA with high glucose)
  - timeline inconsistencies
  - unsupported claims not present in the summary
  - conflicting vitals, labs, or symptoms

Output requirements:
- missingPoints must be specific and actionable (not generic).
- inconsistencies must clearly describe the conflict.
- improvement must include concrete rewrite guidance and example phrasing when helpful.
- Focus on high-impact issues (severity, ED course, admission justification, reasoning).
- Keep output concise and high-signal.

Output a single JSON object ONLY with exactly these keys:
"overall" (number 0–100),
"summary" (string),
"missingPoints" (array of strings),
"inconsistencies" (array of strings),
"improvement" (string).`;

export type HpiInsuranceReviewResult = {
  score: GeneratedHpiScore;
  improvement: string;
};

export async function generateHpiInsuranceReview(
  merged: MergedForHpi,
  hpiText: string,
): Promise<HpiInsuranceReviewResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const clinicalSummaryMarkdown = mergedForHpiToSummaryMarkdown(merged);
  const user = `clinicalSummaryMarkdown:\n${clinicalSummaryMarkdown}\n\n---\n\nhpiText:\n${hpiText.trim()}`;

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: REVIEW_SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.25,
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Empty review response from model");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Review response was not valid JSON");
  }

  const o = parsed as Record<string, unknown>;
  const scoreCandidate = {
    overall: o.overall,
    summary: o.summary,
    missingPoints: o.missingPoints,
    inconsistencies: o.inconsistencies,
  };
  const scoreParsed = generatedHpiScoreSchema.safeParse(scoreCandidate);
  if (!scoreParsed.success) {
    throw new Error("Review JSON did not match expected score shape");
  }

  const improvement =
    typeof o.improvement === "string" ? o.improvement.trim() : "";
  if (!improvement) {
    throw new Error("Review JSON missing improvement");
  }

  return {
    score: scoreParsed.data,
    improvement,
  };
}
