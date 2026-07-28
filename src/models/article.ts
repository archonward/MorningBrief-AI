import { z } from "zod";

const optionalScoreSchema = z.number().min(0).max(1).optional();

export const ArticleSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  url: z.string().url(),
  source: z.string().min(1),
  publishedAt: z.date(),
  description: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  credibilityScore: optionalScoreSchema,
  importanceScore: optionalScoreSchema
});

export type Article = z.infer<typeof ArticleSchema>;
