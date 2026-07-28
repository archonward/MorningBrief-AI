import "dotenv/config";
import { z } from "zod";

const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
const TimezoneSchema = z.string().trim().min(1).refine(isValidTimezone, {
  message: "USER_TIMEZONE must be a valid IANA timezone"
});

const SettingsSchema = z.object({
  // Optional for now. This should become required when AI summarisation is enabled.
  openAiApiKey: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional()
  ),
  userTimezone: TimezoneSchema.default("Asia/Singapore"),
  briefingHour: z.coerce.number().int().min(0).max(23).default(8),
  newsLookbackHours: z.coerce.number().int().positive().default(10),
  maxBriefingItems: z.coerce.number().int().min(1).max(5).default(5),
  logLevel: LogLevelSchema.default("info")
});

export type Settings = z.infer<typeof SettingsSchema>;

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  return SettingsSchema.parse({
    openAiApiKey: env.OPENAI_API_KEY,
    userTimezone: env.USER_TIMEZONE,
    briefingHour: env.BRIEFING_HOUR,
    newsLookbackHours: env.NEWS_LOOKBACK_HOURS,
    maxBriefingItems: env.MAX_BRIEFING_ITEMS,
    logLevel: env.LOG_LEVEL
  });
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
