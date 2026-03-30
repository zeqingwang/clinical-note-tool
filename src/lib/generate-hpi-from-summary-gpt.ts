import OpenAI from "openai";
import type { McgEvaluation, MergedForHpi } from "@/models/case";
import type { HpiStructuredInput } from "@/types/hpi-structured-input";

function chunkLines(text: string, maxChunks = 40): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^#{1,6}\s+/, "").replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, maxChunks);
}

function firstParagraph(text: string, maxLen = 800): string {
  const t = text.trim();
  if (!t) return "";
  const para = t.split(/\n{2,}/)[0] ?? t;
  return para.length > maxLen ? `${para.slice(0, maxLen)}…` : para;
}

/** Best-effort mapping from merged summary fields into `HpiStructuredInput` for the model. */
export function buildHpiStructuredInputFromMerged(merged: MergedForHpi): HpiStructuredInput {
  const hx = [...chunkLines(merged.allergies, 12), ...chunkLines(merged.medications, 12)];
  return {
    patientContext: {
      relevantHistory: hx.length ? Array.from(new Set(hx)) : undefined,
      recentChanges: chunkLines(merged.medications, 8).length
        ? chunkLines(merged.medications, 8)
        : undefined,
    },
    presentation: {
      duration: firstParagraph(merged.timeline, 500) || undefined,
      symptoms: chunkLines(merged.symptoms, 25),
      additionalContext: [
        ...chunkLines(merged.hpiNarratives, 15),
        ...chunkLines(merged.chiefComplaints, 10),
      ],
    },
    initialEvaluation: {
      vitalSignsOrGeneralStatus: chunkLines(merged.vitalsMarkdown, 20).length
        ? chunkLines(merged.vitalsMarkdown, 20)
        : undefined,
      keyExamFindings: chunkLines(merged.keyExamFindings, 20),
    },
    objectiveData: {
      labs: chunkLines(merged.allLabsMarkdown, 35).length
        ? chunkLines(merged.allLabsMarkdown, 35)
        : chunkLines(merged.abnormalLabs, 20),
    },
    clinicalAssessment: {
      primaryDiagnosis: firstParagraph(merged.diagnosisClues, 400) || undefined,
      supportingEvidence: chunkLines(merged.diagnosisClues, 15),
    },
    edCourse: {},
    severity: {
      indicators: chunkLines(merged.positives, 12).length
        ? chunkLines(merged.positives, 12)
        : chunkLines(merged.abnormalLabs, 8),
      levelOfCare: firstParagraph(merged.admissionRationale, 200) || undefined,
    },
    admissionRationale: {
      reasons: chunkLines(merged.admissionRationale, 15),
    },
  };
}

export function mergedForHpiToSummaryMarkdown(merged: MergedForHpi): string {
  const parts: string[] = [];
  const keys = [
    ["Timeline", merged.timeline],
    ["Symptoms", merged.symptoms],
    ["Positives", merged.positives],
    ["Negatives", merged.negatives],
    ["Abnormal labs", merged.abnormalLabs],
    ["Key exam findings", merged.keyExamFindings],
    ["Diagnosis clues", merged.diagnosisClues],
    ["Admission rationale", merged.admissionRationale],
    ["Chief complaints", merged.chiefComplaints],
    ["HPI narratives", merged.hpiNarratives],
    ["Review of systems", merged.rosCombined],
    ["Allergies", merged.allergies],
    ["Medications", merged.medications],
    ["All labs", merged.allLabsMarkdown],
    ["Vitals", merged.vitalsMarkdown],
  ] as const;
  for (const [label, val] of keys) {
    const v = String(val ?? "").trim();
    if (v) parts.push(`## ${label}\n${v}`);
  }
  return parts.join("\n\n");
}

const HPI_SYSTEM = `You are an attending physician writing the History of Present Illness (HPI) for a hospital chart.

You receive:

1) structuredInput — a JSON object typed as HpiStructuredInput (patientContext, presentation, initialEvaluation, objectiveData, clinicalAssessment, edCourse, severity, admissionRationale). Fields may be incomplete or partially noisy.

2) clinicalSummaryMarkdown — a merged clinical summary from multiple source documents.

Task:
Write ONE cohesive, high-quality History of Present Illness (HPI) in natural clinical prose using BOTH inputs.

Guidelines:
- Prioritize factual accuracy. If conflicts exist, prefer clinicalSummaryMarkdown for specific details.
- Do NOT invent, infer, or assume information that is not explicitly supported.
- Omit unknown or missing fields naturally (do not mention absence).

Content Requirements:
- Begin with patient context (age, sex, relevant history, recent medication changes if available).
- Present symptoms in a clear chronological timeline.
- Include key pertinent positives and relevant negatives when available.
- Incorporate important objective findings (exam, vitals, labs) that directly support the clinical picture.
- Explicitly connect objective findings to the working diagnosis using clear clinical reasoning (e.g., “findings consistent with…”).

- MUST include the emergency department (ED) course:
  - Clearly describe treatments already administered in the ED (e.g., fluids, insulin infusion, medications).
  - Do NOT describe only planned or future treatments.

- Reflect severity and acuity using objective indicators:
  - Include concrete severity signals (e.g., severe metabolic acidosis, abnormal labs, need for continuous IV therapy, critical care involvement).

- When describing diagnosis:
  - Do NOT state that laboratory results directly diagnose a condition.
  - Instead, describe objective findings and explicitly state that they are "consistent with" or "suggestive of" the diagnosis.
  - Preferred pattern: "Laboratory evaluation demonstrated [key abnormalities], findings consistent with [diagnosis]."
 
- End with a strong admission rationale:
  - Explicitly justify WHY inpatient or ICU-level care is required.
  - When appropriate, contrast with why discharge or observation would NOT be sufficient.

Style:
- Write in formal, decisive, concise, physician-level clinical languageand explicitly contrast with discharge/observation.
- Use paragraph format only (no JSON, no bullet points).
- Avoid redundancy and unnecessary full normal exam descriptions.
- Focus on clinically relevant and high-yield details that support diagnosis and admission.
- Include etiology/trigger (e.g., recent medication) in the same sentence as the diagnosis when available.
- Describe ED actions using past tense and action-focused phrasing (avoid protocol detail).

Structure:
Ensure the HPI follows this logical progression:
context → timeline → key findings → diagnosis → ED treatment → severity → admission justification

Output:
Write only the HPI narrative body. Do not include explanations or metadata.`;


export type GenerateHpiCandidateVariant = 1 | 2;

export async function generateHpiNaturalLanguageFromMerged(
  merged: MergedForHpi,
  options?: { candidateVariant?: GenerateHpiCandidateVariant; mcgEvaluation?: McgEvaluation },
): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const variant = options?.candidateVariant ?? 1;
  const mcgEvaluation = options?.mcgEvaluation;

  const structuredInput = buildHpiStructuredInputFromMerged(merged);
  const clinicalSummaryMarkdown = mergedForHpiToSummaryMarkdown(merged);

  let user = `structuredInput:\n${JSON.stringify(structuredInput, null, 2)}\n\n---\n\nclinicalSummaryMarkdown:\n${clinicalSummaryMarkdown}\n\n---\n\nmcgEvaluation (payer / MCG readiness):\n${JSON.stringify(
    mcgEvaluation ?? null,
    null,
    2,
  )}`;

  let temperature = 0.35;
  if (variant === 2) {
    temperature = 0.48;
    user += `\n\n---\n\nCandidate variant B (style direction only; same facts as variant A): give slightly stronger emphasis to chronological sequence; tie labs and exam findings to the working diagnosis using cautious phrasing ("consistent with" / "suggestive of"); describe ED treatments already administered in past tense; and make medical necessity for inpatient care (vs observation or discharge) especially explicit. Do not add information that is absent from structuredInput, clinicalSummaryMarkdown, or mcgEvaluation.`;
  }

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: HPI_SYSTEM },
      { role: "user", content: user },
    ],
    temperature,
    max_completion_tokens: 4096,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty HPI response from model");
  }
  return text;
}
