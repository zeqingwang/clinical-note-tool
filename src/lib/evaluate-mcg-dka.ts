import type { McgEvaluation, MergedForHpi } from "@/models/case";

function toLower(s: string | undefined): string {
  return (s ?? "").toLowerCase();
}

function extractFirstNumber(text: string, regex: RegExp): number | null {
  const m = text.match(regex);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function containsAny(text: string, needles: string[]): boolean {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n.toLowerCase()));
}

function extractPhValue(allText: string): number | null {
  // Handles patterns like "pH 7.2", "pH: 7.23"
  return extractFirstNumber(allText, /p\s*h\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/i);
}

function extractBicarbonateValue(allText: string): number | null {
  // Handles patterns like "bicarbonate 14", "HCO3 15"
  return (
    extractFirstNumber(allText, /(bicarbonate)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/i) ??
    extractFirstNumber(allText, /(hco3)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/i)
  );
}

function extractGlucoseValue(allText: string): number | null {
  return extractFirstNumber(allText, /(glucose)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/i);
}

function extractKetonesPositive(allText: string): boolean {
  const t = allText.toLowerCase();
  const mentionsKetones = containsAny(t, ["ketones", "beta-hydroxybutyrate", "beta hydroxybutyrate"]);
  if (!mentionsKetones) return false;
  if (containsAny(t, ["positive", "present", "detected"])) return true;
  // Handles “trace”, “moderate”, etc.
  if (containsAny(t, ["trace", "moderate", "large"])) return true;
  return false;
}

function extractIvInsulinRequired(allText: string): boolean {
  return containsAny(allText, [
    "iv insulin",
    "i.v. insulin",
    "insulin infusion",
    "insulin drip",
    "insulin infusion",
    "started insulin drip",
    "insulin gtt",
  ]);
}

function extractAlteredMentalStatus(allText: string): boolean {
  return containsAny(allText, ["altered mental status", "ams", "confusion", "letharg", "drowsy"]);
}

function extractDehydration(allText: string): boolean {
  return containsAny(allText, ["dehydration", "dehydrated", "dry mucous", "poor skin turgor"]);
}

function extractElectrolyteAbnormality(allText: string): boolean {
  return containsAny(allText, ["electrolyte", "potassium", "hyponatremia", "hypernatremia"]);
}

function extractUnableToToleratePo(allText: string): boolean {
  return containsAny(allText, ["unable to tolerate po", "cannot tolerate po", "po intolerant"]);
}

function extractSglt2Use(allText: string): boolean {
  return containsAny(allText, [
    "sglt2",
    "empagliflozin",
    "dapagliflozin",
    "canagliflozin",
    "ertugliflozin",
    "sodium-glucose co-transporter 2",
  ]);
}

/**
 * MVP payer/MCG readiness evaluation for DKA based on keyword / threshold extraction from `mergedForHpi`.
 * (No external MCG documents yet; this is computed from structured HPI summary text.)
 */
export function evaluateMcgDkaFromMerged(merged: MergedForHpi): McgEvaluation {
  const allText = [
    merged.timeline,
    merged.symptoms,
    merged.positives,
    merged.negatives,
    merged.abnormalLabs,
    merged.keyExamFindings,
    merged.diagnosisClues,
    merged.admissionRationale,
    merged.chiefComplaints,
    merged.hpiNarratives,
    merged.rosCombined,
    merged.allergies,
    merged.medications,
    merged.allLabsMarkdown,
    merged.vitalsMarkdown,
  ]
    .map((s) => toLower(s))
    .join("\n");

  const ph = extractPhValue(allText);
  const bicarbonate = extractBicarbonateValue(allText);
  const glucose = extractGlucoseValue(allText);
  const ketonesPositive = extractKetonesPositive(allText);

  const hasSglt2 = extractSglt2Use(allText);
  const ivInsulinRequired = extractIvInsulinRequired(allText);

  const alteredMentalStatus = extractAlteredMentalStatus(allText);
  const persistentDehydration = extractDehydration(allText);
  const electrolyteAbnormality = extractElectrolyteAbnormality(allText);
  const unableToToleratePo = extractUnableToToleratePo(allText);

  const meetsPh = ph != null ? ph < 7.3 : false;
  const meetsBicarb = bicarbonate != null ? bicarbonate <= 18 : false;

  const meetsDKA = meetsPh && meetsBicarb && ketonesPositive;

  const matchedCriteria: string[] = [];
  if (ph != null && meetsPh) matchedCriteria.push(`pH ${ph}`);
  if (bicarbonate != null && meetsBicarb) matchedCriteria.push(`bicarbonate ${bicarbonate}`);
  if (ketonesPositive) matchedCriteria.push("ketones positive");
  if (hasSglt2) matchedCriteria.push("SGLT2 inhibitor");
  if (ivInsulinRequired) matchedCriteria.push("IV insulin required");

  const pHSevere = ph != null && ph <= 7.25;
  const bicarbSevere = bicarbonate != null && bicarbonate < 15;

  const inpatientIndicators: boolean[] = [
    pHSevere,
    bicarbSevere,
    alteredMentalStatus,
    persistentDehydration,
    electrolyteAbnormality,
    unableToToleratePo,
    ivInsulinRequired,
  ];
  const inpatientJustified = inpatientIndicators.some(Boolean);

  let severityLevel: McgEvaluation["severityLevel"] = "mild";
  if (pHSevere || bicarbSevere || ivInsulinRequired || alteredMentalStatus) severityLevel = "severe";
  else if (meetsDKA) severityLevel = "moderate";

  const icuSuggested = severityLevel === "severe" && (pHSevere || bicarbSevere || alteredMentalStatus);

  // If we found DKA criteria but couldn't extract glucose numeric, we still allow it.
  // This keeps MVP behavior aligned with the example "any or >200 depending".
  void glucose;

  return {
    meetsDKACriteria: meetsDKA,
    severityLevel,
    inpatientJustified,
    icuSuggested,
    matchedCriteria,
  };
}

