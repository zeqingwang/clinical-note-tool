/**
 * Split extracted report text into (1) narrative / clinical content without the lab block
 * and (2) laboratory section only. Used so GPT can structure each part separately.
 *
 * Heuristic: finds a line that looks like a lab section header, then takes lines until
 * the next major section. If no header matches, the full string is "body" and labs are empty.
 */

function labSectionHeaderLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 100) return false;

  return [
    /^LABORATORY\b/i,
    /^LAB(?:ORATORY)?\s+RESULTS?\b/i,
    /^LABS?\s*:?\s*$/i,
    /^CHEMISTRY\b/i,
    /^CBC\b/i,
    /^BMP\b/i,
    /^CMP\b/i,
    /^COMPLETE\s+BLOOD\b/i,
    /^BASIC\s+METABOLIC\b/i,
    /^COMPREHENSIVE\s+METABOLIC\b/i,
    /^COAGULATION\b/i,
    /^COAGS?\b/i,
    /^ARTERIAL\s+BLOOD\s+GAS\b/i,
    /^VENOUS\s+BLOOD\s+GAS\b/i,
    /^ABG\b/i,
    /^VBG\b/i,
  ].some((re) => re.test(t));
}

function majorSectionAfterLabsLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 120) return false;

  return [
    /^IMPRESSION\b/i,
    /^ASSESSMENT\b/i,
    /^ASSESSMENT\s+AND\s+PLAN\b/i,
    /^PLAN\b/i,
    /^MEDICAL\s+DECISION\b/i,
    /^MDM\b/i,
    /^DISPOSITION\b/i,
    /^RADIOLOGY\b/i,
    /^IMAGING\b/i,
    /^SIGNATURE\b/i,
    /^ATTESTATION\b/i,
  ].some((re) => re.test(t));
}

export function splitNoteBodyAndLabs(fullText: string): { bodyText: string; labText: string } {
  const normalized = fullText.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let labStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (labSectionHeaderLine(lines[i] ?? "")) {
      labStart = i;
      break;
    }
  }

  if (labStart < 0) {
    return { bodyText: fullText, labText: "" };
  }

  let labEnd = lines.length;
  for (let i = labStart + 1; i < lines.length; i++) {
    if (majorSectionAfterLabsLine(lines[i] ?? "")) {
      labEnd = i;
      break;
    }
  }

  const labLines = lines.slice(labStart, labEnd);
  const labText = labLines.join("\n").trim();
  const before = lines.slice(0, labStart).join("\n");
  const after = lines.slice(labEnd).join("\n");
  const bodyText = [before, after].filter((s) => s.trim().length > 0).join("\n\n").trim();

  return { bodyText, labText };
}
