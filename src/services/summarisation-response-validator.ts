import { z } from "zod";
import type { Article } from "../models/article.js";
import {
  SummarisationResponseSchema,
  type SummarisationItem
} from "../models/summarisation.js";

export function validateSummarisationResponse(
  selectedArticles: readonly Article[],
  externalResponse: unknown
): SummarisationItem[] {
  const parsedResponse = SummarisationResponseSchema.safeParse(externalResponse);

  if (!parsedResponse.success) {
    throw new Error(
      `Invalid summarisation response: ${formatZodIssues(parsedResponse.error)}`
    );
  }

  const selectedArticleIds = selectedArticles.map(({ id }) => id);
  const duplicateSelectedArticleId = findDuplicate(selectedArticleIds);

  if (duplicateSelectedArticleId !== undefined) {
    throw new Error(
      `Invalid selected article batch: duplicate article ID "${duplicateSelectedArticleId}"`
    );
  }

  const itemsByArticleId = new Map<string, SummarisationItem>();

  for (const item of parsedResponse.data.items) {
    if (itemsByArticleId.has(item.articleId)) {
      throw new Error(
        `Invalid summarisation response: duplicate article ID "${item.articleId}"`
      );
    }

    itemsByArticleId.set(item.articleId, item);
  }

  const selectedArticleIdSet = new Set(selectedArticleIds);
  const unknownArticleIds = Array.from(itemsByArticleId.keys()).filter(
    (articleId) => !selectedArticleIdSet.has(articleId)
  );

  if (unknownArticleIds.length > 0) {
    throw new Error(
      `Invalid summarisation response: unknown article ID${unknownArticleIds.length === 1 ? "" : "s"} ${formatIds(
        unknownArticleIds
      )}`
    );
  }

  const missingArticleIds = selectedArticleIds.filter(
    (articleId) => !itemsByArticleId.has(articleId)
  );

  if (missingArticleIds.length > 0) {
    throw new Error(
      `Invalid summarisation response: missing item${missingArticleIds.length === 1 ? "" : "s"} for article ID${missingArticleIds.length === 1 ? "" : "s"} ${formatIds(
        missingArticleIds
      )}`
    );
  }

  return selectedArticleIds.map((articleId) => {
    const item = itemsByArticleId.get(articleId);

    if (item === undefined) {
      throw new Error(
        `Invalid summarisation response: missing item for article ID "${articleId}"`
      );
    }

    return item;
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
