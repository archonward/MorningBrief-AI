import { z } from "zod";
import { ArticleSchema, type Article } from "./article.js";

export const RankingRequestCandidateSchema = z
  .object({
    articleId: ArticleSchema.shape.id,
    title: ArticleSchema.shape.title,
    url: ArticleSchema.shape.url,
    source: ArticleSchema.shape.source,
    publishedAt: z.string().datetime({ offset: true }),
    description: ArticleSchema.shape.description,
    content: ArticleSchema.shape.content,
    category: ArticleSchema.shape.category
  })
  .strict();

export type RankingRequestCandidate = z.infer<
  typeof RankingRequestCandidateSchema
>;

export const RankingRequestSchema = z
  .object({
    candidates: z.array(RankingRequestCandidateSchema)
  })
  .strict()
  .superRefine(({ candidates }, context) => {
    const seenArticleIds = new Set<string>();

    for (const [index, candidate] of candidates.entries()) {
      if (seenArticleIds.has(candidate.articleId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate article ID "${candidate.articleId}"`,
          path: ["candidates", index, "articleId"]
        });
      }

      seenArticleIds.add(candidate.articleId);
    }
  });

export type RankingRequest = z.infer<typeof RankingRequestSchema>;

export function createRankingRequest(
  candidates: readonly Article[]
): RankingRequest {
  const seenArticleIds = new Set<string>();

  for (const candidate of candidates) {
    if (seenArticleIds.has(candidate.id)) {
      throw new Error(
        `Invalid ranking request: Duplicate article ID "${candidate.id}"`
      );
    }

    seenArticleIds.add(candidate.id);
  }

  return RankingRequestSchema.parse({
    candidates: candidates.map((article) => ({
      articleId: article.id,
      title: article.title,
      url: article.url,
      source: article.source,
      publishedAt: article.publishedAt.toISOString(),
      ...(article.description === undefined
        ? {}
        : { description: article.description }),
      ...(article.content === undefined ? {} : { content: article.content }),
      ...(article.category === undefined ? {} : { category: article.category })
    }))
  });
}
