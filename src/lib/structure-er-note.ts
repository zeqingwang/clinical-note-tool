import OpenAI from "openai";
import type { ParsedERNote } from "@/models/case";

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
  "labResults": Array<{
    "testName": string,
    "result": string | number,
    "units": string,
    "referenceRange": string,
    "isAbnormal": boolean
  }>,
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
- labResults: extract explicit labs only; otherwise [].
- medicalDecisionErCourse: split content into the optional subfields when possible; otherwise put everything in fullNarrative.
- clinicalImpression: list of impression lines as strings (e.g. ["Euglycemic DKA"]).
- condition and disposition: short phrases (e.g. "critical", "admit to ICU").`;

export async function structureErNoteFromRawText(rawText: string): Promise<ParsedERNote> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const openai = new OpenAI({ apiKey: key });
  const maxChars = 120_000;
  const trimmed = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ER_NOTE_JSON_SYSTEM },
      {
        role: "user",
        content: `Parse the following clinical note into JSON.\n\n---\n${trimmed}\n---`,
      },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw?.trim()) {
    throw new Error("Empty response from language model");
  }

  try {
    return JSON.parse(raw) as ParsedERNote;
  } catch {
    throw new Error("Model returned invalid JSON");
  }
}
