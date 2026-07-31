import "dotenv/config";
import {
  loadRequiredAiRankingSettings,
  type RequiredAiRankingSettings
} from "./ai-ranking-settings.js";

export type AiRankingDiagnosticSettings = RequiredAiRankingSettings;

export function loadAiRankingDiagnosticSettings(
  env: NodeJS.ProcessEnv = process.env
): AiRankingDiagnosticSettings {
  return loadRequiredAiRankingSettings(env, "AI ranking diagnostics");
}
