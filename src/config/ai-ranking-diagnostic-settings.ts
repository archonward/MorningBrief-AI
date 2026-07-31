import "dotenv/config";

export interface AiRankingDiagnosticSettings {
  openAiApiKey: string;
  openAiRankingModel: string;
  aiRankingMaxCandidates: number;
}

const DEFAULT_AI_RANKING_MAX_CANDIDATES = 20;
const MIN_AI_RANKING_MAX_CANDIDATES = 1;
const MAX_AI_RANKING_MAX_CANDIDATES = 50;

export function loadAiRankingDiagnosticSettings(
  env: NodeJS.ProcessEnv = process.env
): AiRankingDiagnosticSettings {
  const openAiApiKey = env.OPENAI_API_KEY?.trim();
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required for AI ranking diagnostics");
  }

  const openAiRankingModel = env.OPENAI_RANKING_MODEL?.trim();
  if (!openAiRankingModel) {
    throw new Error("OPENAI_RANKING_MODEL is required for AI ranking diagnostics");
  }

  return {
    openAiApiKey,
    openAiRankingModel,
    aiRankingMaxCandidates: parseAiRankingMaxCandidates(
      env.AI_RANKING_MAX_CANDIDATES
    )
  };
}

function parseAiRankingMaxCandidates(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_AI_RANKING_MAX_CANDIDATES;
  }

  const trimmedValue = value.trim();
  if (!/^-?\d+$/.test(trimmedValue)) {
    throw new Error("AI_RANKING_MAX_CANDIDATES must be an integer from 1 to 50");
  }

  const parsedValue = Number(trimmedValue);
  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < MIN_AI_RANKING_MAX_CANDIDATES ||
    parsedValue > MAX_AI_RANKING_MAX_CANDIDATES
  ) {
    throw new Error("AI_RANKING_MAX_CANDIDATES must be an integer from 1 to 50");
  }

  return parsedValue;
}
