export interface OptionalAiRankingSettings {
  openAiApiKey?: string;
  openAiRankingModel?: string;
  aiRankingMaxCandidates: number;
}

export interface RequiredAiRankingSettings {
  openAiApiKey: string;
  openAiRankingModel: string;
  aiRankingMaxCandidates: number;
}

export const DEFAULT_AI_RANKING_MAX_CANDIDATES = 20;
export const MIN_AI_RANKING_MAX_CANDIDATES = 1;
export const MAX_AI_RANKING_MAX_CANDIDATES = 50;

export function loadOptionalAiRankingSettings(
  env: NodeJS.ProcessEnv
): OptionalAiRankingSettings {
  const openAiApiKey = optionalTrimmedValue(env.OPENAI_API_KEY);
  const openAiRankingModel = optionalTrimmedValue(env.OPENAI_RANKING_MODEL);

  return {
    ...(openAiApiKey === undefined ? {} : { openAiApiKey }),
    ...(openAiRankingModel === undefined ? {} : { openAiRankingModel }),
    aiRankingMaxCandidates: parseAiRankingMaxCandidates(
      env.AI_RANKING_MAX_CANDIDATES
    )
  };
}

export function loadRequiredAiRankingSettings(
  env: NodeJS.ProcessEnv,
  context: string
): RequiredAiRankingSettings {
  const settings = loadOptionalAiRankingSettings(env);

  if (settings.openAiApiKey === undefined) {
    throw new Error(`OPENAI_API_KEY is required for ${context}`);
  }
  if (settings.openAiRankingModel === undefined) {
    throw new Error(`OPENAI_RANKING_MODEL is required for ${context}`);
  }

  return {
    openAiApiKey: settings.openAiApiKey,
    openAiRankingModel: settings.openAiRankingModel,
    aiRankingMaxCandidates: settings.aiRankingMaxCandidates
  };
}

export function parseAiRankingMaxCandidates(
  value: string | undefined
): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_AI_RANKING_MAX_CANDIDATES;
  }

  const trimmedValue = value.trim();
  if (!/^\d+$/.test(trimmedValue)) {
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

function optionalTrimmedValue(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}
