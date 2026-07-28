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
      logLevel: "info"
    });
  });

  it("rejects an invalid IANA timezone", () => {
    expect(() => loadSettings({ USER_TIMEZONE: "Mars/Olympus" })).toThrow(
      "USER_TIMEZONE must be a valid IANA timezone"
    );
  });
});
