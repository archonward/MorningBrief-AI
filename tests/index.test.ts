import { describe, expect, it } from "vitest";
import { calculateNewsWindow, isMainModule } from "../src/index.js";

describe("calculateNewsWindow", () => {
  it("anchors the window to 08:00 in Asia/Singapore", () => {
    const result = calculateNewsWindow(
      10,
      new Date("2026-07-28T03:30:00.000Z"),
      "Asia/Singapore",
      8
    );

    expect(result.endTime.toISOString()).toBe("2026-07-28T00:00:00.000Z");
    expect(result.startTime.toISOString()).toBe("2026-07-27T14:00:00.000Z");
  });

  it("uses the previous local briefing boundary before briefing time", () => {
    const result = calculateNewsWindow(
      10,
      new Date("2026-07-27T23:00:00.000Z"),
      "Asia/Singapore",
      8
    );

    expect(result.endTime.toISOString()).toBe("2026-07-27T00:00:00.000Z");
    expect(result.startTime.toISOString()).toBe("2026-07-26T14:00:00.000Z");
  });

  it("uses the current boundary when run exactly at briefing time", () => {
    const result = calculateNewsWindow(
      10,
      new Date("2026-07-28T00:00:00.000Z"),
      "Asia/Singapore",
      8
    );

    expect(result.endTime.toISOString()).toBe("2026-07-28T00:00:00.000Z");
  });

  it("rejects invalid calculation inputs", () => {
    expect(() => calculateNewsWindow(0)).toThrow(
      "lookbackHours must be a positive integer"
    );
    expect(() =>
      calculateNewsWindow(10, new Date(), "Asia/Singapore", 24)
    ).toThrow("briefingHour must be an integer from 0 to 23");
  });
});

describe("isMainModule", () => {
  it("matches a Windows entry path to its file URL", () => {
    expect(
      isMainModule(
        "file:///C:/projects/morningbrief/dist/src/index.js",
        "C:\\projects\\morningbrief\\dist\\src\\index.js"
      )
    ).toBe(process.platform === "win32");
  });

  it("does not match a different entry path", () => {
    expect(
      isMainModule(
        "file:///C:/projects/morningbrief/dist/src/index.js",
        "C:\\projects\\morningbrief\\dist\\scripts\\run-briefing.js"
      )
    ).toBe(false);
  });

  it("does not match when the entry path is missing", () => {
    expect(isMainModule(import.meta.url, undefined)).toBe(false);
  });
});
