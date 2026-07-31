import { describe, expect, it } from "vitest";
import { loadAiRankingDiagnosticSettings } from "../src/config/ai-ranking-diagnostic-settings.js";

describe("loadAiRankingDiagnosticSettings", () => {
  it("loads required OpenAI settings and the default candidate limit", () => {
    expect(
      loadAiRankingDiagnosticSettings({
        OPENAI_API_KEY: " sk-test ",
        OPENAI_RANKING_MODEL: " gpt-ranking "
      })
    ).toEqual({
      openAiApiKey: "sk-test",
      openAiRankingModel: "gpt-ranking",
      aiRankingMaxCandidates: 20
    });
  });

  it("rejects a missing API key", () => {
    expect(() =>
      loadAiRankingDiagnosticSettings({
        OPENAI_RANKING_MODEL: "gpt-ranking"
      })
    ).toThrow("OPENAI_API_KEY is required");
  });

  it("rejects a missing model", () => {
    expect(() =>
      loadAiRankingDiagnosticSettings({
        OPENAI_API_KEY: "sk-test",
        OPENAI_RANKING_MODEL: "  "
      })
    ).toThrow("OPENAI_RANKING_MODEL is required");
  });

  it("rejects an invalid diagnostic limit", () => {
    expect(() =>
      loadAiRankingDiagnosticSettings({
        OPENAI_API_KEY: "sk-test",
        OPENAI_RANKING_MODEL: "gpt-ranking",
        AI_RANKING_MAX_CANDIDATES: "1.5"
      })
    ).toThrow("AI_RANKING_MAX_CANDIDATES must be an integer from 1 to 50");
    expect(() =>
      loadAiRankingDiagnosticSettings({
        OPENAI_API_KEY: "sk-test",
        OPENAI_RANKING_MODEL: "gpt-ranking",
        AI_RANKING_MAX_CANDIDATES: "0"
      })
    ).toThrow("AI_RANKING_MAX_CANDIDATES must be an integer from 1 to 50");
    expect(() =>
      loadAiRankingDiagnosticSettings({
        OPENAI_API_KEY: "sk-test",
        OPENAI_RANKING_MODEL: "gpt-ranking",
        AI_RANKING_MAX_CANDIDATES: "51"
      })
    ).toThrow("AI_RANKING_MAX_CANDIDATES must be an integer from 1 to 50");
  });
});
