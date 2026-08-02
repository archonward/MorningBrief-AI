import { z } from "zod";
import { ARTICLE_ID_MAX_LENGTH } from "./article.js";
import { BriefingItemSchema } from "./briefing.js";

export const SUMMARISATION_UNCERTAINTY_MAX_LENGTH = 1_000;

const summarisationUncertaintySchema = z
  .string()
  .trim()
  .min(1)
  .max(SUMMARISATION_UNCERTAINTY_MAX_LENGTH)
  .describe(
    "Missing context, conflicting reporting, ambiguity, thin source evidence, or other relevant limitations"
  )
  // Strict Structured Outputs represents optional fields as required and nullable.
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);

export const SummarisationItemSchema = z
  .object({
    articleId: z
      .string()
      .min(1)
      .max(ARTICLE_ID_MAX_LENGTH)
      .refine((value) => value === value.trim(), {
        message: "Article ID must be copied exactly without surrounding whitespace"
      }),
    headline: BriefingItemSchema.shape.headline.describe(
      "A concise briefing headline without application-owned source metadata"
    ),
    summary: BriefingItemSchema.shape.summary.describe(
      "A factual summary based only on the supplied article information"
    ),
    whyItMatters: BriefingItemSchema.shape.whyItMatters.describe(
      "The practical significance of the specific development"
    ),
    uncertainty: summarisationUncertaintySchema
  })
  .strict();

export type SummarisationItem = z.infer<typeof SummarisationItemSchema>;

export const SummarisationResponseSchema = z
  .object({
    items: z.array(SummarisationItemSchema)
  })
  .strict();

export type SummarisationResponse = z.infer<
  typeof SummarisationResponseSchema
>;
