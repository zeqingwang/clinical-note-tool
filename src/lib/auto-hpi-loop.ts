import type { MergedForHpi } from "@/models/case";
import type { GeneratedHpiEntry } from "@/types/case";
import { evaluateMcgDkaFromMerged } from "@/lib/evaluate-mcg-dka";
import { generateHpiNaturalLanguageFromMerged } from "@/lib/generate-hpi-from-summary-gpt";
import { generateHpiInsuranceReview } from "@/lib/generate-hpi-review-gpt";
import { regenerateHpiWithUserNotes } from "@/lib/generate-hpi-regenerate-gpt";
import { buildFullReviewRegeneratePrompt } from "@/lib/hpi-regenerate-instruction";

const AUTO_REFINE_MAX = 10;
const AUTO_NO_IMPROVE_STOP = 2;

function reviewOverallScore(e: GeneratedHpiEntry): number {
  const o = e.score?.overall;
  return typeof o === "number" && !Number.isNaN(o) ? o : -1;
}

async function reviewToEntry(
  text: string,
  merged: MergedForHpi,
  mcgEvaluation = evaluateMcgDkaFromMerged(merged),
): Promise<GeneratedHpiEntry> {
  const r = await generateHpiInsuranceReview(merged, text, mcgEvaluation);
  const now = new Date().toISOString();
  return {
    type: "generated",
    text,
    createdAt: now,
    score: r.score,
    improvement: r.improvement,
    reviewGeneratedAt: now,
  };
}

/**
 * Runs candidate generation, reviews, and refines entirely in memory.
 * @returns The best HPI text observed (by review overall score) along the run.
 */
export async function runAutoHpiLoopInMemory(merged: MergedForHpi): Promise<string> {
  const mcgEvaluation = evaluateMcgDkaFromMerged(merged);
  const textA = await generateHpiNaturalLanguageFromMerged(merged, {
    candidateVariant: 1,
    mcgEvaluation,
  });
  const textB = await generateHpiNaturalLanguageFromMerged(merged, {
    candidateVariant: 2,
    mcgEvaluation,
  });

  const reviewedA = await reviewToEntry(textA, merged, mcgEvaluation);
  const reviewedB = await reviewToEntry(textB, merged, mcgEvaluation);

  const scoreA = reviewOverallScore(reviewedA);
  const scoreB = reviewOverallScore(reviewedB);
  let working: GeneratedHpiEntry = scoreA >= scoreB ? reviewedA : reviewedB;

  let bestText = working.text;
  let bestScore = reviewOverallScore(working);
  let prevScore = bestScore;
  let noImproveStreak = 0;

  for (let i = 0; i < AUTO_REFINE_MAX; i++) {
    const prompt = buildFullReviewRegeneratePrompt(working);
    const newText = await regenerateHpiWithUserNotes(merged, working.text, prompt, mcgEvaluation);
    const reviewed = await reviewToEntry(newText, merged, mcgEvaluation);
    const newScore = reviewOverallScore(reviewed);

    if (newScore > bestScore) {
      bestScore = newScore;
      bestText = newText;
    }

    if (newScore > prevScore) {
      noImproveStreak = 0;
    } else {
      noImproveStreak += 1;
      if (noImproveStreak >= AUTO_NO_IMPROVE_STOP) {
        break;
      }
    }

    prevScore = newScore;
    working = reviewed;
  }

  return bestText;
}
