import { z } from "zod";

export const BRIEFING_HEADLINE_MAX_LENGTH = 500;
export const BRIEFING_SUMMARY_MAX_LENGTH = 4_000;
export const BRIEFING_WHY_IT_MATTERS_MAX_LENGTH = 2_000;

export const BriefingItemSchema = z.object({
  headline: z.string().trim().min(1).max(BRIEFING_HEADLINE_MAX_LENGTH),
  summary: z.string().trim().min(1).max(BRIEFING_SUMMARY_MAX_LENGTH),
  whyItMatters: z
    .string()
    .trim()
    .min(1)
    .max(BRIEFING_WHY_IT_MATTERS_MAX_LENGTH),
  source: z.string().trim().min(1).max(200),
  url: z
    .string()
    .url()
    .refine(isHttpUrl, "URL must use HTTP or HTTPS"),
  publishedAt: z.date()
});

export type BriefingItem = z.infer<typeof BriefingItemSchema>;

export const MorningBriefingSchema = z
  .object({
    generatedAt: z.date(),
    timeWindowStart: z.date(),
    timeWindowEnd: z.date(),
    items: z.array(BriefingItemSchema).max(5)
  })
  .refine(
    ({ timeWindowStart, timeWindowEnd }) =>
      timeWindowStart.getTime() <= timeWindowEnd.getTime(),
    {
      message: "Briefing time window start must not be after its end",
      path: ["timeWindowStart"]
    }
  );

export type MorningBriefing = z.infer<typeof MorningBriefingSchema>;

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
