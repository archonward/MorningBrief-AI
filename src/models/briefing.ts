import { z } from "zod";

export const BriefingItemSchema = z.object({
  headline: z.string().trim().min(1).max(500),
  summary: z.string().trim().min(1).max(4_000),
  whyItMatters: z.string().trim().min(1).max(2_000),
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
