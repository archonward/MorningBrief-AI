import { z } from "zod";

export const BriefingItemSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  whyItMatters: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url(),
  publishedAt: z.date()
});

export type BriefingItem = z.infer<typeof BriefingItemSchema>;

export const MorningBriefingSchema = z.object({
  generatedAt: z.date(),
  timeWindowStart: z.date(),
  timeWindowEnd: z.date(),
  items: z.array(BriefingItemSchema).max(5)
});

export type MorningBriefing = z.infer<typeof MorningBriefingSchema>;
