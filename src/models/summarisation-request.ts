import { z } from "zod";
import { ArticleSchema, type Article } from "./article.js";
import { SummarisationItemSchema } from "./summarisation.js";

export const SummarisationRequestArticleSchema = z
  .object({
    articleId: SummarisationItemSchema.shape.articleId,
    title: ArticleSchema.shape.title,
    source: ArticleSchema.shape.source,
    url: ArticleSchema.shape.url,
    publishedAt: z.string().datetime({ offset: true }),
    description: ArticleSchema.shape.description,
    content: ArticleSchema.shape.content,
    category: ArticleSchema.shape.category
  })
  .strict();

export type SummarisationRequestArticle = z.infer<
  typeof SummarisationRequestArticleSchema
>;

export const SummarisationRequestSchema = z
  .object({
    articles: z.array(SummarisationRequestArticleSchema)
  })
  .strict()
  .superRefine(({ articles }, context) => {
    const seenArticleIds = new Set<string>();

    for (const [index, article] of articles.entries()) {
      if (seenArticleIds.has(article.articleId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate article ID "${article.articleId}"`,
          path: ["articles", index, "articleId"]
        });
      }

      seenArticleIds.add(article.articleId);
    }
  });

export type SummarisationRequest = z.infer<typeof SummarisationRequestSchema>;

export function createSummarisationRequest(
  selectedArticles: readonly Article[]
): SummarisationRequest {
  const seenArticleIds = new Set<string>();

  for (const article of selectedArticles) {
    if (seenArticleIds.has(article.id)) {
      throw new Error(
        `Invalid summarisation request: Duplicate article ID "${article.id}"`
      );
    }

    seenArticleIds.add(article.id);
  }

  let requestData: unknown;
  try {
    requestData = {
      articles: selectedArticles.map((article) => ({
        articleId: article.id,
        title: article.title,
        source: article.source,
        url: article.url,
        publishedAt: article.publishedAt.toISOString(),
        ...(article.description === undefined
          ? {}
          : { description: article.description }),
        ...(article.content === undefined ? {} : { content: article.content }),
        ...(article.category === undefined
          ? {}
          : { category: article.category })
      }))
    };
  } catch (error) {
    throw new Error(
      `Invalid summarisation request: ${getErrorMessage(error)}`,
      { cause: error }
    );
  }

  const parsedRequest = SummarisationRequestSchema.safeParse(requestData);

  if (!parsedRequest.success) {
    throw new Error(
      `Invalid summarisation request: ${formatZodIssues(parsedRequest.error)}`
    );
  }

  return parsedRequest.data;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "request";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
