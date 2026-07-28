import { z } from "zod";

export const ARTICLE_TITLE_MAX_LENGTH = 500;
export const ARTICLE_DESCRIPTION_MAX_LENGTH = 4_000;
export const ARTICLE_CONTENT_MAX_LENGTH = 20_000;

const optionalScoreSchema = z.number().min(0).max(1).optional();
const httpUrlSchema = z
  .string()
  .url()
  .refine(isHttpUrl, "URL must use HTTP or HTTPS");

export const ArticleSchema = z.object({
  id: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(ARTICLE_TITLE_MAX_LENGTH),
  url: httpUrlSchema,
  source: z.string().trim().min(1).max(200),
  publishedAt: z.date(),
  description: z.string().max(ARTICLE_DESCRIPTION_MAX_LENGTH).optional(),
  content: z.string().max(ARTICLE_CONTENT_MAX_LENGTH).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  credibilityScore: optionalScoreSchema,
  importanceScore: optionalScoreSchema
});

export type Article = z.infer<typeof ArticleSchema>;

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
