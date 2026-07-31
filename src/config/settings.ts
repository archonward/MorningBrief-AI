import "dotenv/config";
import { z } from "zod";
import {
  loadOptionalAiRankingSettings,
  loadRequiredAiRankingSettings
} from "./ai-ranking-settings.js";

const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
const TimezoneSchema = z.string().trim().min(1).refine(isValidTimezone, {
  message: "USER_TIMEZONE must be a valid IANA timezone"
});

const BaseSettingsSchema = z.object({
  userTimezone: TimezoneSchema.default("Asia/Singapore"),
  briefingHour: z.coerce.number().int().min(0).max(23).default(8),
  newsLookbackHours: z.coerce.number().int().positive().default(10),
  maxBriefingItems: z.coerce.number().int().min(1).max(5).default(5),
  logLevel: LogLevelSchema.default("info")
});

export type Settings = z.infer<typeof BaseSettingsSchema> & {
  aiRankingEnabled: boolean;
  openAiApiKey?: string;
  openAiRankingModel?: string;
  aiRankingMaxCandidates: number;
};

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const baseSettings = BaseSettingsSchema.parse({
    userTimezone: env.USER_TIMEZONE,
    briefingHour: env.BRIEFING_HOUR,
    newsLookbackHours: env.NEWS_LOOKBACK_HOURS,
    maxBriefingItems: env.MAX_BRIEFING_ITEMS,
    logLevel: env.LOG_LEVEL
  });
  const aiRankingEnabled = parseExplicitBoolean(
    env.AI_RANKING_ENABLED,
    "AI_RANKING_ENABLED"
  );
  const aiRankingSettings = aiRankingEnabled
    ? loadRequiredAiRankingSettings(env, "production AI ranking")
    : loadOptionalAiRankingSettings(env);

  return {
    ...baseSettings,
    aiRankingEnabled,
    ...aiRankingSettings
  };
}

function parseExplicitBoolean(
  value: string | undefined,
  variableName: string
): boolean {
  if (value === undefined || value.trim() === "") {
    return false;
  }

  const trimmedValue = value.trim();
  if (trimmedValue === "true") {
    return true;
  }
  if (trimmedValue === "false") {
    return false;
  }

  throw new Error(`${variableName} must be either "true" or "false"`);
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
