import type { Article } from "../models/article.js";
import { createHeadlineFingerprint } from "../services/headline-deduplicator.js";

export interface CandidatePairDiagnostic {
  leftCandidate: number;
  rightCandidate: number;
  sharedHeadlineTokens: string[];
  headlineTokenJaccard: number;
  sharedDescriptionTokens: string[] | null;
  descriptionTokenJaccard: number | null;
  publicationTimeDifferenceMinutes: number;
  sameCategory: boolean;
  sameSource: boolean;
  headlineLengthDifference: number;
}

export function createCandidatePairDiagnostics(
  candidates: readonly Article[]
): CandidatePairDiagnostic[] {
  const diagnostics: CandidatePairDiagnostic[] = [];

  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    const left = candidates[leftIndex];
    if (!left) continue;

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < candidates.length;
      rightIndex += 1
    ) {
      const right = candidates[rightIndex];
      if (!right) continue;

      const headlineComparison = compareTokenSets(left.title, right.title);
      const descriptionComparison =
        left.description === undefined || right.description === undefined
          ? null
          : compareTokenSets(left.description, right.description);

      diagnostics.push({
        leftCandidate: leftIndex + 1,
        rightCandidate: rightIndex + 1,
        sharedHeadlineTokens: headlineComparison.sharedTokens,
        headlineTokenJaccard: headlineComparison.jaccard,
        sharedDescriptionTokens: descriptionComparison?.sharedTokens ?? null,
        descriptionTokenJaccard: descriptionComparison?.jaccard ?? null,
        publicationTimeDifferenceMinutes: roundTo(
          Math.abs(left.publishedAt.getTime() - right.publishedAt.getTime()) /
            (60 * 1000),
          2
        ),
        sameCategory:
          left.category !== undefined && left.category === right.category,
        sameSource: left.source === right.source,
        headlineLengthDifference: Math.abs(
          left.title.length - right.title.length
        )
      });
    }
  }

  return diagnostics;
}

interface TokenComparison {
  sharedTokens: string[];
  jaccard: number;
}

function compareTokenSets(left: string, right: string): TokenComparison {
  const leftTokens = createTokenSet(left);
  const rightTokens = createTokenSet(right);
  const sharedTokens = Array.from(leftTokens)
    .filter((token) => rightTokens.has(token))
    .sort();
  const union = new Set([...leftTokens, ...rightTokens]);

  return {
    sharedTokens,
    jaccard:
      union.size === 0 ? 0 : roundTo(sharedTokens.length / union.size, 4)
  };
}

function createTokenSet(value: string): Set<string> {
  const normalised = createHeadlineFingerprint(value);
  return new Set(normalised ? normalised.split(" ") : []);
}

function roundTo(value: number, decimalPlaces: number): number {
  return Number(value.toFixed(decimalPlaces));
}
