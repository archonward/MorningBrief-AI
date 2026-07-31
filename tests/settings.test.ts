import { describe, expect, it } from "vitest";
import { loadSettings } from "../src/config/settings.js";

describe("loadSettings", () => {
  it("loads the default Singapore briefing settings", () => {
    const settings = loadSettings({});

    expect(settings).toMatchObject({
      userTimezone: "Asia/Singapore",
      briefingHour: 8,
      newsLookbackHours: 10,
      maxBriefingItems: 5,
      logLevel: "info",
      aiRankingEnabled: false,
      aiRankingMaxCandidates: 20
    });
    expect(settings.openAiApiKey).toBeUndefined();
    expect(settings.openAiRankingModel).toBeUndefined();
  });

  it("rejects an invalid IANA timezone", () => {
    expect(() => loadSettings({ USER_TIMEZONE: "Mars/Olympus" })).toThrow(
      "USER_TIMEZONE must be a valid IANA timezone"
    );
  });

  it("does not require AI credentials when ranking is disabled", () => {
    expect(
      loadSettings({
        AI_RANKING_ENABLED: "false",
        AI_RANKING_MAX_CANDIDATES: "3"
      })
    ).toMatchObject({
      aiRankingEnabled: false,
      aiRankingMaxCandidates: 3
    });
  });

  it("requires an API key and model when ranking is enabled", () => {
    expect(() =>
      loadSettings({
        AI_RANKING_ENABLED: "true",
        OPENAI_RANKING_MODEL: "gpt-ranking"
      })
    ).toThrow("OPENAI_API_KEY is required for production AI ranking");

    expect(() =>
      loadSettings({
        AI_RANKING_ENABLED: "true",
        OPENAI_API_KEY: "sk-test-secret",
        OPENAI_RANKING_MODEL: " "
      })
    ).toThrow("OPENAI_RANKING_MODEL is required for production AI ranking");
  });

  it("rejects invalid boolean values", () => {
    for (const value of ["1", "yes", "TRUE", "enabled"]) {
      expect(() => loadSettings({ AI_RANKING_ENABLED: value })).toThrow(
        'AI_RANKING_ENABLED must be either "true" or "false"'
      );
    }
  });

  it("rejects invalid candidate limits in either mode", () => {
    expect(() =>
      loadSettings({ AI_RANKING_MAX_CANDIDATES: "0" })
    ).toThrow("AI_RANKING_MAX_CANDIDATES must be an integer from 1 to 50");
    expect(() =>
      loadSettings({ AI_RANKING_MAX_CANDIDATES: "51" })
    ).toThrow("AI_RANKING_MAX_CANDIDATES must be an integer from 1 to 50");
  });

  it("parses valid enabled settings and trims secrets and model names", () => {
    expect(
      loadSettings({
        AI_RANKING_ENABLED: "true",
        OPENAI_API_KEY: " sk-test-secret ",
        OPENAI_RANKING_MODEL: " gpt-ranking ",
        AI_RANKING_MAX_CANDIDATES: "3"
      })
    ).toMatchObject({
      aiRankingEnabled: true,
      openAiApiKey: "sk-test-secret",
      openAiRankingModel: "gpt-ranking",
      aiRankingMaxCandidates: 3
    });
  });

  it("does not expose secrets in configuration errors", () => {
    const secret = "sk-super-secret-value";

    try {
      loadSettings({
        AI_RANKING_ENABLED: "true",
        OPENAI_API_KEY: secret,
        OPENAI_RANKING_MODEL: "",
        AI_RANKING_MAX_CANDIDATES: "invalid"
      });
      throw new Error("Expected configuration validation to fail");
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
