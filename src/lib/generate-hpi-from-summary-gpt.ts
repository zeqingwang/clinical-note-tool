import OpenAI from "openai";
import type { MergedForHpi } from "@/models/case";
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
1) structuredInput — a JSON object typed as HpiStructuredInput (patientContext, presentation, initialEvaluation, objectiveData, clinicalAssessment, edCourse, severity, admissionRationale). Fields may be partial or noisy.
2) clinicalSummaryMarkdown — a merged markdown summary from multiple source documents.

Use BOTH to write ONE cohesive HPI in natural clinical prose (paragraphs). Do not output JSON or bullet lists unless brief standard medical enumeration is unavoidable. Do not restate the prompt. If data conflict, prefer clinicalSummaryMarkdown for specifics. Omit unknowns; do not invent facts not supported by the inputs.

Write only the HPI narrative body.`;

export async function generateHpiNaturalLanguageFromMerged(merged: MergedForHpi): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const structuredInput = buildHpiStructuredInputFromMerged(merged);
  const clinicalSummaryMarkdown = mergedForHpiToSummaryMarkdown(merged);

  const user = `structuredInput:\n${JSON.stringify(structuredInput, null, 2)}\n\n---\n\nclinicalSummaryMarkdown:\n${clinicalSummaryMarkdown}`;

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: HPI_SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.35,
    max_completion_tokens: 4096,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty HPI response from model");
  }
  return text;
}
