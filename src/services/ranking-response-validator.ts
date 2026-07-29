import { z } from "zod";
import type { Article } from "../models/article.js";
import {
  RankingResponseSchema,
  type RankingAssessment
} from "../models/ranking-assessment.js";

export function validateRankingResponse(
  candidates: readonly Article[],
  externalResponse: unknown
): RankingAssessment[] {
  const parsedResponse = RankingResponseSchema.safeParse(externalResponse);

  if (!parsedResponse.success) {
    throw new Error(
      `Invalid ranking response: ${formatZodIssues(parsedResponse.error)}`
    );
  }

  const candidateIds = candidates.map(({ id }) => id);
  const duplicateCandidateId = findDuplicate(candidateIds);

  if (duplicateCandidateId !== undefined) {
    throw new Error(
      `Invalid candidate batch: duplicate article ID "${duplicateCandidateId}"`
    );
  }

  const assessmentsByArticleId = new Map<string, RankingAssessment>();

  for (const assessment of parsedResponse.data.assessments) {
    if (assessmentsByArticleId.has(assessment.articleId)) {
      throw new Error(
        `Invalid ranking response: duplicate article ID "${assessment.articleId}"`
      );
    }

    assessmentsByArticleId.set(assessment.articleId, assessment);
  }

  const candidateIdSet = new Set(candidateIds);
  const unknownArticleIds = Array.from(assessmentsByArticleId.keys()).filter(
    (articleId) => !candidateIdSet.has(articleId)
  );

  if (unknownArticleIds.length > 0) {
    throw new Error(
      `Invalid ranking response: unknown article ID${unknownArticleIds.length === 1 ? "" : "s"} ${formatIds(
        unknownArticleIds
      )}`
    );
  }

  const missingArticleIds = candidateIds.filter(
    (articleId) => !assessmentsByArticleId.has(articleId)
  );

  if (missingArticleIds.length > 0) {
    throw new Error(
      `Invalid ranking response: missing assessment${missingArticleIds.length === 1 ? "" : "s"} for article ID${missingArticleIds.length === 1 ? "" : "s"} ${formatIds(
        missingArticleIds
      )}`
    );
  }

  return candidateIds.map((articleId) => {
    const assessment = assessmentsByArticleId.get(articleId);

    if (assessment === undefined) {
      throw new Error(
        `Invalid ranking response: missing assessment for article ID "${articleId}"`
      );
    }

    return assessment;
  });
}

function findDuplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }

    seen.add(value);
  }

  return undefined;
}

function formatIds(ids: readonly string[]): string {
  return ids.map((id) => `"${id}"`).join(", ");
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "response";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
