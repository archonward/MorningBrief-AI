import { z } from "zod";

export const RANKING_RATIONALE_MAX_LENGTH = 1_000;
export const RANKING_UNCERTAINTY_MAX_LENGTH = 1_000;

const rankingScoreSchema = z.number().finite().min(0).max(1);
const rankingUncertaintySchema = z
  .string()
  .trim()
  .min(1)
  .max(RANKING_UNCERTAINTY_MAX_LENGTH)
  .describe(
    "Missing context, conflicting reporting, ambiguity, or other relevant limitations"
  )
  // Strict Structured Outputs represents optional fields as required and nullable.
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);

export const RankingAssessmentSchema = z
  .object({
    articleId: z.string().trim().min(1).max(128),
    significanceScore: rankingScoreSchema.describe(
      "The model's assessment of the development's briefing importance, not an objective fact"
    ),
    confidenceScore: rankingScoreSchema.describe(
      "Confidence in the assessment given the available article information"
    ),
    rationale: z
      .string()
      .trim()
      .min(1)
      .max(RANKING_RATIONALE_MAX_LENGTH)
      .describe("A brief explanation of the main reason for the score"),
    uncertainty: rankingUncertaintySchema
  })
  .strict();

export type RankingAssessment = z.infer<typeof RankingAssessmentSchema>;

export const RankingResponseSchema = z
  .object({
    assessments: z.array(RankingAssessmentSchema)
  })
  .strict();

export type RankingResponse = z.infer<typeof RankingResponseSchema>;
