import type { GeneratedHpiEntry } from "@/types/case";

export type HpiRegenerateInstructionDraft = {
  missingPoints: string[];
  inconsistencies: string[];
  suggestedImprovements: string[];
  custom: string;
};

export function emptyRegenInstruction(): HpiRegenerateInstructionDraft {
  return {
    missingPoints: [],
    inconsistencies: [],
    suggestedImprovements: [],
    custom: "",
  };
}

export function appendUniqueItem(list: string[], item: string): string[] {
  const t = item.trim();
  if (!t) return list;
  if (list.some((x) => x === t)) return list;
  return [...list, t];
}

export function regenInstructionToPrompt(d: HpiRegenerateInstructionDraft): string {
  const parts: string[] = [];
  if (d.missingPoints.length > 0) {
    parts.push(
      "## Missing or thin points to address\n" + d.missingPoints.map((x) => `- ${x}`).join("\n"),
    );
  }
  if (d.inconsistencies.length > 0) {
    parts.push(
      "## Inconsistencies to resolve\n" + d.inconsistencies.map((x) => `- ${x}`).join("\n"),
    );
  }
  if (d.suggestedImprovements.length > 0) {
    parts.push(
      "## Suggested improvements (from review)\n" +
        d.suggestedImprovements.map((x) => `- ${x.replace(/\r?\n/g, " ").trim()}`).join("\n"),
    );
  }
  const custom = d.custom.trim();
  if (custom.length > 0) {
    parts.push("## Custom instructions from author\n" + custom);
  }
  return parts.join("\n\n");
}

export function isRegenInstructionEmpty(d: HpiRegenerateInstructionDraft): boolean {
  return (
    d.missingPoints.length === 0 &&
    d.inconsistencies.length === 0 &&
    d.suggestedImprovements.length === 0 &&
    d.custom.trim() === ""
  );
}

/**
 * Full payer review payload for regeneration (auto-loop): score, summary, lists, full improvement text,
 * and review metadata. Prefer this when the model should see everything from the review step.
 */
export function buildFullReviewRegeneratePrompt(entry: GeneratedHpiEntry): string {
  const parts: string[] = [];
  if (entry.score) {
    parts.push(
      "## Payer readiness score (complete)\n" +
        `- Overall: ${Math.round(entry.score.overall)}/100\n` +
        `- Summary: ${entry.score.summary}`,
    );
    if (entry.score.missingPoints.length > 0) {
      parts.push(
        "## Missing or thin points (from review)\n" +
          entry.score.missingPoints.map((x) => `- ${x}`).join("\n"),
      );
    }
    if (entry.score.inconsistencies.length > 0) {
      parts.push(
        "## Inconsistencies (from review)\n" +
          entry.score.inconsistencies.map((x) => `- ${x}`).join("\n"),
      );
    }
  }
  if (entry.improvement?.trim()) {
    parts.push("## Suggested improvements — full narrative (verbatim)\n" + entry.improvement.trim());
  }
  if (entry.reviewGeneratedAt?.trim()) {
    parts.push(`## Review metadata\n- reviewGeneratedAt: ${entry.reviewGeneratedAt}`);
  }
  const out = parts.join("\n\n").trim();
  if (out.length > 0) return out;
  return (
    "## Custom instructions from author\n" +
    "Refine this HPI for clarity, timeline, consistency with the clinical summary, and explicit admission rationale. Do not invent facts."
  );
}

/** Builds regeneration prompt from persisted review fields (auto-loop / tooling). Always non-empty. */
export function buildAutoRegeneratePromptFromReview(entry: GeneratedHpiEntry): string {
  const draft: HpiRegenerateInstructionDraft = {
    missingPoints: entry.score ? [...entry.score.missingPoints] : [],
    inconsistencies: entry.score ? [...entry.score.inconsistencies] : [],
    suggestedImprovements: entry.improvement
      ? entry.improvement.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
      : [],
    custom: entry.score?.summary?.trim()
      ? `Payer-readiness summary to address: ${entry.score.summary}`
      : "",
  };
  const structured = regenInstructionToPrompt(draft).trim();
  if (structured.length > 0) return structured;
  return (
    "## Custom instructions from author\n" +
    "Refine this HPI for clarity, timeline, consistency with the clinical summary, and explicit admission rationale. Do not invent facts."
  );
}

export function findGeneratedHpiEntry(
  list: GeneratedHpiEntry[],
  ref: Pick<GeneratedHpiEntry, "createdAt" | "text">,
): GeneratedHpiEntry | null {
  const hit = list.find((e) => e.createdAt === ref.createdAt && e.text === ref.text);
  return hit ?? null;
}
