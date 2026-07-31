import {
  MAX_AI_RANKING_MAX_CANDIDATES,
  MIN_AI_RANKING_MAX_CANDIDATES
} from "../config/ai-ranking-settings.js";
import type { Article } from "../models/article.js";
import type { RankingAssessment } from "../models/ranking-assessment.js";

export interface AiRankingServicePort {
  assess(candidates: readonly Article[]): Promise<RankingAssessment[]>;
}

export class AiBriefingCandidateRanker {
  public constructor(
    private readonly aiRankingService: AiRankingServicePort,
    private readonly maxCandidates: number
  ) {
    if (
      !Number.isInteger(maxCandidates) ||
      maxCandidates < MIN_AI_RANKING_MAX_CANDIDATES ||
      maxCandidates > MAX_AI_RANKING_MAX_CANDIDATES
    ) {
      throw new Error(
        "AI briefing candidate limit must be an integer from 1 to 50"
      );
    }
  }

  public async rank(candidates: readonly Article[]): Promise<Article[]> {
    if (candidates.length === 0) {
      return [];
    }

    const submittedCandidates = candidates.slice(0, this.maxCandidates);
    const excludedCandidates = candidates.slice(this.maxCandidates);
    const assessments =
      await this.aiRankingService.assess(submittedCandidates);
    const assessmentsByArticleId = joinAssessments(
      submittedCandidates,
      assessments
    );

    const rankedSubmittedCandidates = submittedCandidates
      .map((article, originalIndex) => ({
        article,
        originalIndex,
        assessment: assessmentsByArticleId.get(article.id)!
      }))
      .sort((left, right) => {
        const significanceDifference =
          right.assessment.significanceScore -
          left.assessment.significanceScore;
        if (significanceDifference !== 0) {
          return significanceDifference;
        }

        const confidenceDifference =
          right.assessment.confidenceScore - left.assessment.confidenceScore;
        if (confidenceDifference !== 0) {
          return confidenceDifference;
        }

        return left.originalIndex - right.originalIndex;
      })
      .map(({ article }) => article);

    return [...rankedSubmittedCandidates, ...excludedCandidates];
  }
}

function joinAssessments(
  candidates: readonly Article[],
  assessments: readonly RankingAssessment[]
): Map<string, RankingAssessment> {
  const candidateIds = new Set(candidates.map(({ id }) => id));
  const assessmentsByArticleId = new Map<string, RankingAssessment>();

  for (const assessment of assessments) {
    if (!candidateIds.has(assessment.articleId)) {
      throw new Error(
        `AI ranking service returned an assessment for unknown article ID "${assessment.articleId}"`
      );
    }
    if (assessmentsByArticleId.has(assessment.articleId)) {
      throw new Error(
        `AI ranking service returned duplicate assessment for article ID "${assessment.articleId}"`
      );
    }

    assessmentsByArticleId.set(assessment.articleId, assessment);
  }

  for (const candidate of candidates) {
    if (!assessmentsByArticleId.has(candidate.id)) {
      throw new Error(
        `AI ranking service returned no assessment for article ID "${candidate.id}"`
      );
    }
  }

  return assessmentsByArticleId;
}
