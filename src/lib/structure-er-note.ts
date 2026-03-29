import OpenAI from "openai";
import type { LabResult, ParsedERNote } from "@/models/case";
import { splitNoteBodyAndLabs } from "@/lib/split-note-body-and-labs";

const LAB_RESULTS_ONLY_SYSTEM = `You are a clinical data extractor. Output ONE JSON object only (no markdown):

{ "labResults": Array<{
  "testName": string,
  "result": string | number,
  "units": string,
  "referenceRange": string,
  "isAbnormal": boolean
}> }

Rules:
- Include one object per distinct laboratory result line or table row in the source (CBC, BMP/CMP, coags, ABG/VBG, cardiac enzymes, lactate, troponin, etc.). Preserve the order they appear.
- Do not summarize, merge unlike rows, or cap the count. If the note lists 40 tests, return 40 objects.
- Use "" for missing units or reference range. Set isAbnormal from flags (H/L/critical) when present, otherwise false.
- If there are no labs, return { "labResults": [] }.`;

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
      { role: "system", content: LAB_RESULTS_ONLY_SYSTEM },
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

const ER_NOTE_JSON_SYSTEM = `You are a clinical documentation assistant. Given raw text from an ER / emergency note (possibly OCR or copy-paste), output ONE JSON object only (no markdown) that matches this TypeScript shape:

{
  "chiefComplaint": string,
  "hpiSummary": string,
  "pastMedicalHistory": string,
  "pastSurgicalHistory": string,
  "familyHistory": string,
  "allergies": string,
  "medications": string,
  "socialHistory": string,
  "ROS": string,
  "vitalsigns": Array<{
    "dateTime": string,
    "bpMmHg"?: string,
    "bpPosition"?: string,
    "mapMmHg"?: number,
    "heartRate"?: number,
    "pulseSite"?: string,
    "respirationRate"?: number,
    "tempCelsius"?: number,
    "tempFahrenheit"?: number,
    "spo2Percent"?: number,
    "o2LitersPerMin"?: number,
    "fio2"?: string | number,
    "etco2MmHg"?: number,
    "o2Device"?: string,
    "bloodSugar"?: string | number,
    "painScore"?: string | number,
    "heightInches"?: number,
    "heightCm"?: number,
    "weightKg"?: number,
    "weightLbsOz"?: string,
    "scale"?: string,
    "bmi"?: number,
    "bsa"?: number,
    "headCircumferenceCm"?: number
  }>,
  "physicalExam": {
    "generalAppearance": string,
    "heent": string,
    "neck": string,
    "lungs": string,
    "heart": string,
    "abdomen": string,
    "extremities": string,
    "neurologic": string,
    "vascular": string,
    "skin": string,
    "psych": string
  },
  "labResults": [],
  "medicalDecisionErCourse": {
    "evaluationAndMonitoring"?: string,
    "presentationRecap"?: string,
    "differentialAndReasoning"?: string,
    "dataReviewAndStudies"?: string,
    "interventionsAndManagement"?: string,
    "consultations"?: string,
    "criticalCareTime"?: { "minutes"?: number, "narrative": string },
    "fullNarrative"?: string
  },
  "clinicalImpression": string[],
  "condition": string,
  "disposition": string
}

Rules:
- Use empty string "" for unknown narrative fields; use [] for arrays when there is no data.
- vitalsigns: include one row per set in the note; dateTime can be "unknown" if not given.
- labResults: MUST always be the empty array []. Laboratory values are parsed in a separate step from dedicated lab text; do not invent or paste labs here.
- medicalDecisionErCourse: split content into the optional subfields when possible; otherwise put everything in fullNarrative.
- clinicalImpression: list of impression lines as strings (e.g. ["Euglycemic DKA"]).
- condition and disposition: short phrases (e.g. "critical", "admit to ICU").`;

async function structureBodyFromText(
  openai: OpenAI,
  bodyText: string,
  maxCompletionTokens: number,
): Promise<ParsedERNote> {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ER_NOTE_JSON_SYSTEM },
      {
        role: "user",
        content: `Parse the following clinical note excerpt into JSON. This text intentionally omits the laboratory results block (if any); those are processed separately.\n\n---\n${bodyText}\n---`,
      },
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
    return JSON.parse(raw) as ParsedERNote;
  } catch {
    throw new Error("Model returned invalid JSON");
  }
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

  /** Narrative pass: prefer text without the isolated lab block; if split found nothing, use full text. */
  const structureBody = bodyText.trim().length > 0 ? bodyText : trimmed;

  /** Lab pass: isolated lab section when detected; otherwise full note (same as legacy fallback). */
  const labSource = labText.trim().length > 0 ? labText : trimmed;

  const maxCompletionTokens = (() => {
    const rawEnv = process.env.OPENAI_MAX_COMPLETION_TOKENS?.trim();
    if (rawEnv) {
      const n = Number.parseInt(rawEnv, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 16_384;
  })();

  const skipLabRefinement =
    process.env.OPENAI_SKIP_LAB_REFINEMENT === "1" ||
    process.env.OPENAI_SKIP_LAB_REFINEMENT === "true";

  const labPromise: Promise<LabResult[]> = skipLabRefinement
    ? Promise.resolve([])
    : extractLabResultsOnly(openai, labSource, maxCompletionTokens).catch(() => []);

  const bodyPromise = structureBodyFromText(openai, structureBody, maxCompletionTokens);

  const [parsed, labs] = await Promise.all([bodyPromise, labPromise]);

  return { ...parsed, labResults: labs };
}
