import type { SourceDocumentType } from "@/types/case";

/** Strip path and extension (e.g. `ER_Note.pdf` → `ER_Note`). */
function stemFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, "");
  return base.replace(/\.[^.]+$/i, "");
}

/** Insert spaces in CamelCase / letter-number boundaries so `ProgressNote` → `Progress Note`. */
function expandCompactName(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");
}

/** Underscores/hyphens → spaces; lowercase. */
function normalizeTokens(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\-–—]+/g, " ")
    .replace(/\.+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HP_SIGNALS: { re: RegExp; weight: number }[] = [
  { re: /\b(progress\s+note|daily\s+progress)\b/i, weight: 10 },
  { re: /\b(hospital\s+progress)\b/i, weight: 10 },
  { re: /\b(h\s*&\s*p|h\s+and\s+p|handp|hnp)\b/i, weight: 11 },
  { re: /\b(discharge\s+summary)\b/i, weight: 9 },
  { re: /\b(admission\s+note)\b/i, weight: 8 },
  { re: /\b(hospital\s+day)\b/i, weight: 7 },
  { re: /\b(inpatient|floor\s+note|ip\s+note|rounding)\b/i, weight: 8 },
  { re: /\bhp\s+note\b/i, weight: 8 },
  { re: /\bprogress\b/i, weight: 5 },
  { re: /\bpn\b/i, weight: 3 },
];

/** No bare `\bed\b` alone (names like “Ed”); pair ER/ED with note/visit/dept or use full words. */
const ER_SIGNALS: { re: RegExp; weight: number }[] = [
  { re: /\b(emergency|emergency\s+department)\b/i, weight: 11 },
  { re: /\b(triage)\b/i, weight: 10 },
  { re: /\b(er\s+note|ed\s+note)\b/i, weight: 11 },
  { re: /\b(er\s+visit|ed\s+visit)\b/i, weight: 11 },
  { re: /\b(er\s+record|ed\s+record)\b/i, weight: 9 },
  { re: /\b(e\.?r\.?|e\.?d\.?)\s*(note|visit|record|dept|course|summary)\b/i, weight: 10 },
  { re: /\b(er|ed)\s+(note|visit|record)\b/i, weight: 11 },
  { re: /(?:^|\s)(er|ed)(?:\s|$)/i, weight: 4 },
];

const OTHER_SIGNAL = /\b(other|misc|generic|unknown\s*type)\b/i;

function scoreSignals(blob: string, signals: { re: RegExp; weight: number }[]): number {
  let total = 0;
  for (const { re, weight } of signals) {
    if (re.test(blob)) {
      total += weight;
    }
  }
  return total;
}

/**
 * Fast path: if **file name** or **case title** clearly indicates ER vs HP, return that type.
 * Otherwise returns `null` so the caller can use GPT (or another fallback).
 *
 * - ER: `er note`, `emergency`, `er`/`ed`/`triage` as words, `er visit`, `ed visit`, or literal `ER` in the original text.
 * - HP: `hospital`, `physical`, `hp`, `h&p`, `h and p`.
 * - If both match, returns `null` (ambiguous).
 */
export function matchSimpleDocumentType(input: {
  fileName: string;
  caseTitle?: string;
}): SourceDocumentType | null {
  const stemRaw = stemFromFileName(input.fileName);
  const stem = normalizeTokens(expandCompactName(stemRaw));
  const title = normalizeTokens(expandCompactName(input.caseTitle ?? ""));
  const blob = [stem, title].filter((s) => s.length > 0).join(" ");
  if (!blob.trim()) {
    return null;
  }

  const originalBlob = `${stemRaw} ${input.caseTitle ?? ""}`;

  const erHit =
    /\ber\s+note\b/i.test(blob) ||
    /\bemergency\b/i.test(blob) ||
    /\btriage\b/i.test(blob) ||
    /\ber\s+visit\b/i.test(blob) ||
    /\bed\s+visit\b/i.test(blob) ||
    /\bed\s+note\b/i.test(blob) ||
    /\b(er|ed)\b/i.test(blob) ||
    /\bER\b/.test(originalBlob);

  const hpHit =
    /\bhospital\b/i.test(blob) ||
    /\bphysical\b/i.test(blob) ||
    /\bhp\b/i.test(blob) ||
    /\bh\s*&\s*p\b/i.test(blob) ||
    /\bh\s+and\s+p\b/i.test(blob);

  if (erHit && hpHit) {
    return null;
  }
  if (erHit) {
    return "ER_NOTE";
  }
  if (hpHit) {
    return "HP_NOTE";
  }
  return null;
}

/**
 * Optional explicit type from the client (`FormData` field `documentType`: ER_NOTE | HP_NOTE | OTHER).
 */
export function parseDocumentTypeFormOverride(raw: FormDataEntryValue | null): SourceDocumentType | null {
  if (raw == null || typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  if (v === "ER_NOTE" || v === "HP_NOTE" || v === "OTHER") {
    return v as SourceDocumentType;
  }
  return null;
}

/**
 * Infer document type from **file name** and optional **case title**.
 * CamelCase and underscores are expanded (`ProgressNote.pdf` → progress note).
 */
export function inferSourceDocumentType(input: {
  fileName: string;
  caseTitle?: string;
}): SourceDocumentType {
  const stemRaw = stemFromFileName(input.fileName);
  const stem = normalizeTokens(expandCompactName(stemRaw));
  const title = normalizeTokens(expandCompactName(input.caseTitle ?? ""));
  const blob = [stem, title].filter((s) => s.length > 0).join(" ");

  if (!blob.trim()) {
    return "ER_NOTE";
  }

  const hpScore = scoreSignals(blob, HP_SIGNALS);
  const erScore = scoreSignals(blob, ER_SIGNALS);

  if (OTHER_SIGNAL.test(blob) && erScore === 0 && hpScore === 0) {
    return "OTHER";
  }

  if (hpScore > erScore) {
    return "HP_NOTE";
  }
  if (erScore > hpScore) {
    return "ER_NOTE";
  }

  if (/\b(progress|admission|inpatient|discharge|hospital|rounding|floor)\b/i.test(blob)) {
    return "HP_NOTE";
  }
  if (/\b(emergency|triage|er\s|ed\s)\b/i.test(blob)) {
    return "ER_NOTE";
  }

  return "ER_NOTE";
}

/** @deprecated Prefer {@link inferSourceDocumentType} with `caseTitle` when available. */
export function inferSourceDocumentTypeFromFileName(fileName: string): SourceDocumentType {
  return inferSourceDocumentType({ fileName });
}
