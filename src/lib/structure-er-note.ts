import OpenAI from "openai";
import {
  labResultsWrapperSchema,
  parsedERNoteBodySchema,
  parsedHPBodySchema,
  parsedOtherNoteSchema,
  schemaToPromptBlock,
  type LabResult,
  type ParsedERNote,
  type ParsedHP,
  type ParsedOtherNote,
  type StructuredOutput,
} from "@/models/case";
import type { SourceDocumentType } from "@/types/case";
import { splitNoteBodyAndLabs } from "@/lib/split-note-body-and-labs";

function readMaxCompletionTokens(): number {
  const rawEnv = process.env.OPENAI_MAX_COMPLETION_TOKENS?.trim();
  if (rawEnv) {
    const n = Number.parseInt(rawEnv, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 16_384;
}

function labResultsOnlySystemPrompt(): string {
  return `You are a clinical data extractor. Output ONE JSON object only (no markdown).

The output must conform to this JSON Schema:

${schemaToPromptBlock(labResultsWrapperSchema)}

Rules:
- Include one object per distinct laboratory result line or table row in the source (CBC, BMP/CMP, coags, ABG/VBG, cardiac enzymes, lactate, troponin, etc.). Preserve the order they appear.
- Do not summarize, merge unlike rows, or cap the count.
- Use "" for missing units or reference range. Set isAbnormal from flags (H/L/critical) when present, otherwise false.
- If there are no labs, return { "labResults": [] }.`;
}

function erNoteBodySystemPrompt(): string {
  return `You are a clinical documentation assistant. Given raw text from an ER / emergency note (possibly OCR or copy-paste), output ONE JSON object only (no markdown).

The output must conform to this JSON Schema:

${schemaToPromptBlock(parsedERNoteBodySchema)}

Rules:
- Use empty string "" for unknown narrative fields; use [] for arrays when there is no data.
- vitalsigns: include one row per set in the note; dateTime can be "unknown" if not given.
- labResults must remain exactly [] (laboratory values are merged from a separate extraction step).
- medicalDecisionErCourse: split content into the optional subfields when possible; otherwise put everything in fullNarrative.
- clinicalImpression: list of impression lines as strings (e.g. ["Euglycemic DKA"]).
- condition and disposition: short phrases (e.g. "critical", "admit to ICU").`;
}

function hpNoteBodySystemPrompt(): string {
  return `You are a clinical documentation assistant. Given raw text from a hospital progress note, H&P, or similar inpatient documentation (possibly OCR or copy-paste), output ONE JSON object only (no markdown).

The output must conform to this JSON Schema:

${schemaToPromptBlock(parsedHPBodySchema)}

Rules:
- Use empty string "" or omit optional sections when unknown.
- vitalsigns: include rows present in the note when applicable.
- labResults must remain exactly [] (laboratory values are merged from a separate extraction step).
- assessmentPlan.problems: include diagnoses and plan items when present in the text.`;
}

function otherNoteSystemPrompt(): string {
  return `You are a clinical documentation assistant. Given raw clinical text, output ONE JSON object only (no markdown).

The output must conform to this JSON Schema:

${schemaToPromptBlock(parsedOtherNoteSchema)}

Rules:
- summary: concise narrative capture when the document does not fit a specific ER or progress-note template.`;
}

function coerceLabRow(x: unknown): LabResult | null {
  if (x == null || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.testName !== "string") return null;
  const result = o.result;
  if (typeof result !== "string" && typeof result !== "number") return null;
  return {
    testName: o.testName,
    result,
    units: typeof o.units === "string" ? o.units : "",
    referenceRange: typeof o.referenceRange === "string" ? o.referenceRange : "",
    isAbnormal: Boolean(o.isAbnormal),
  };
}

async function extractLabResultsOnly(
  openai: OpenAI,
  rawText: string,
  maxCompletionTokens: number,
): Promise<LabResult[]> {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: labResultsOnlySystemPrompt() },
      {
        role: "user",
        content: `Extract every lab result from the text below.\n\n---\n${rawText}\n---`,
      },
    ],
    temperature: 0.1,
    max_completion_tokens: maxCompletionTokens,
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error("Lab extraction hit the token limit");
  }

  const raw = choice?.message?.content;
  if (!raw?.trim()) {
    throw new Error("Empty lab extraction response");
  }

  const data = JSON.parse(raw) as { labResults?: unknown };
  if (!Array.isArray(data.labResults)) {
    return [];
  }

  const out: LabResult[] = [];
  for (const row of data.labResults) {
    const coerced = coerceLabRow(row);
    if (coerced) out.push(coerced);
  }
  return out;
}

async function callJsonModel(
  openai: OpenAI,
  systemPrompt: string,
  userContent: string,
  maxCompletionTokens: number,
): Promise<unknown> {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
    max_completion_tokens: maxCompletionTokens,
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error(
      "Structured output hit the token limit. Set OPENAI_MAX_COMPLETION_TOKENS higher or split the note.",
    );
  }

  const raw = choice?.message?.content;
  if (!raw?.trim()) {
    throw new Error("Empty response from language model");
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Model returned invalid JSON");
  }
}

async function structureErBodyFromText(
  openai: OpenAI,
  bodyText: string,
  maxCompletionTokens: number,
): Promise<ParsedERNote> {
  const userContent = `Parse the following clinical note excerpt into JSON. This text intentionally omits the isolated laboratory block when possible; labs are merged separately.\n\n---\n${bodyText}\n---`;
  const parsed = await callJsonModel(openai, erNoteBodySystemPrompt(), userContent, maxCompletionTokens);
  return parsed as ParsedERNote;
}

async function structureHpBodyFromText(
  openai: OpenAI,
  bodyText: string,
  maxCompletionTokens: number,
): Promise<ParsedHP> {
  const userContent = `Parse the following inpatient / progress note excerpt into JSON. Laboratory rows are merged separately.\n\n---\n${bodyText}\n---`;
  const parsed = await callJsonModel(openai, hpNoteBodySystemPrompt(), userContent, maxCompletionTokens);
  return parsed as ParsedHP;
}

export async function structureErNoteFromRawText(rawText: string): Promise<ParsedERNote> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey: key });
  const maxChars = 120_000;
  const trimmed = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;

  const { bodyText, labText } = splitNoteBodyAndLabs(trimmed);
  const structureBody = bodyText.trim().length > 0 ? bodyText : trimmed;
  const labSource = labText.trim().length > 0 ? labText : trimmed;

  const maxCompletionTokens = readMaxCompletionTokens();
  const skipLabRefinement =
    process.env.OPENAI_SKIP_LAB_REFINEMENT === "1" ||
    process.env.OPENAI_SKIP_LAB_REFINEMENT === "true";

  const labPromise: Promise<LabResult[]> = skipLabRefinement
    ? Promise.resolve([])
    : extractLabResultsOnly(openai, labSource, maxCompletionTokens).catch(() => []);

  const bodyPromise = structureErBodyFromText(openai, structureBody, maxCompletionTokens);

  const [parsed, labs] = await Promise.all([bodyPromise, labPromise]);

  return { ...parsed, labResults: labs };
}

export async function structureHpNoteFromRawText(rawText: string): Promise<ParsedHP> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey: key });
  const maxChars = 120_000;
  const trimmed = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;

  const { bodyText, labText } = splitNoteBodyAndLabs(trimmed);
  const structureBody = bodyText.trim().length > 0 ? bodyText : trimmed;
  const labSource = labText.trim().length > 0 ? labText : trimmed;

  const maxCompletionTokens = readMaxCompletionTokens();
  const skipLabRefinement =
    process.env.OPENAI_SKIP_LAB_REFINEMENT === "1" ||
    process.env.OPENAI_SKIP_LAB_REFINEMENT === "true";

  const labPromise: Promise<LabResult[]> = skipLabRefinement
    ? Promise.resolve([])
    : extractLabResultsOnly(openai, labSource, maxCompletionTokens).catch(() => []);

  const bodyPromise = structureHpBodyFromText(openai, structureBody, maxCompletionTokens);

  const [parsed, labs] = await Promise.all([bodyPromise, labPromise]);

  const merged: ParsedHP = { ...parsed };
  if (labs.length > 0) {
    merged.labResults = labs;
  }
  return merged;
}

export async function structureOtherNoteFromRawText(rawText: string): Promise<ParsedOtherNote> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey: key });
  const maxChars = 120_000;
  const trimmed = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;
  const maxCompletionTokens = readMaxCompletionTokens();

  const userContent = `Summarize and structure the following text.\n\n---\n${trimmed}\n---`;
  const parsed = await callJsonModel(openai, otherNoteSystemPrompt(), userContent, maxCompletionTokens);
  return parsed as ParsedOtherNote;
}

/**
 * Routes to the correct schema / pipeline from {@link SourceDocumentType}.
 */
export async function structureFromRawText(
  rawText: string,
  kind: SourceDocumentType,
): Promise<StructuredOutput> {
  switch (kind) {
    case "HP_NOTE":
      return structureHpNoteFromRawText(rawText);
    case "OTHER":
      return structureOtherNoteFromRawText(rawText);
    case "ER_NOTE":
    default:
      return structureErNoteFromRawText(rawText);
  }
}
