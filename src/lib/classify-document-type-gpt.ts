import OpenAI from "openai";
import { inferSourceDocumentType, matchSimpleDocumentType } from "@/lib/infer-document-type";
import type { SourceDocumentType } from "@/types/case";

const CLASSIFIER_SYSTEM = `You classify which clinical document schema should be used for parsing.

Output ONE JSON object only (no markdown), shape:
{ "type": "ER_NOTE" | "HP_NOTE" | "OTHER", "reason": string }

Definitions:
- ER_NOTE: Emergency department / urgent care / triage visit documentation (ED, ER, emergency note, ED visit).
- HP_NOTE: Inpatient documentation such as hospital progress note, daily progress, H&P, admission note, discharge summary, floor note, rounding note.
- OTHER: Does not clearly fit ER or HP (e.g. clinic follow-up only, generic summary, unknown).

Use the file name and optional case title as signals; they may be abbreviated or noisy. Keep "reason" to one short sentence (under 200 characters).`;

export type ClassificationSource = "override" | "simple" | "gpt" | "heuristic";

export type DocumentClassificationResult = {
  type: SourceDocumentType;
  reason: string;
  source: Exclude<ClassificationSource, "override">;
};

function parseClassificationJson(raw: string): { type?: SourceDocumentType; reason?: string } {
  try {
    const o = JSON.parse(raw) as { type?: unknown; reason?: unknown };
    const type = o.type;
    const reason = typeof o.reason === "string" ? o.reason : "";
    if (type === "ER_NOTE" || type === "HP_NOTE" || type === "OTHER") {
      return { type, reason };
    }
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * 1) Simple keyword rules on file name + case title (ER / er note vs hospital / physical / hp).
 * 2) If unclear, call GPT.
 * 3) If GPT unavailable or fails, use weighted {@link inferSourceDocumentType}.
 */
export async function classifyDocumentTypeWithGpt(input: {
  fileName: string;
  caseTitle?: string;
}): Promise<DocumentClassificationResult> {
  const simple = matchSimpleDocumentType(input);
  if (simple !== null) {
    return {
      type: simple,
      reason:
        simple === "ER_NOTE"
          ? "Matched ER keywords (e.g. er note, emergency, er/ed, or ER in name)"
          : "Matched HP keywords (hospital, physical, hp, or H&P)",
      source: "simple",
    };
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  const skip =
    process.env.OPENAI_SKIP_GPT_DOCUMENT_CLASSIFY === "1" ||
    process.env.OPENAI_SKIP_GPT_DOCUMENT_CLASSIFY === "true";

  if (!key || skip) {
    const type = inferSourceDocumentType(input);
    return {
      type,
      reason: skip ? "Heuristic (GPT classification disabled)" : "Heuristic (no API key)",
      source: "heuristic",
    };
  }

  const openai = new OpenAI({ apiKey: key });
  const user = `File name: ${input.fileName}
Case title (may be empty): ${input.caseTitle ?? ""}

Which schema type applies?`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CLASSIFIER_SYSTEM },
        { role: "user", content: user },
      ],
      temperature: 0,
      max_completion_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error("Empty classifier response");
    }

    const { type, reason } = parseClassificationJson(raw);
    if (type) {
      return {
        type,
        reason: reason || "Classified by model",
        source: "gpt",
      };
    }
  } catch {
    /* fall through */
  }

  const type = inferSourceDocumentType(input);
  return {
    type,
    reason: "Heuristic fallback after GPT or parse error",
    source: "heuristic",
  };
}
