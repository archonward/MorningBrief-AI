import { describe, expect, it } from "vitest";
import { cleanRssText } from "../src/utils/text-cleaner.js";

describe("cleanRssText", () => {
  it("removes HTML tags", () => {
    expect(cleanRssText("<p>Breaking <strong>news</strong></p>")).toBe(
      "Breaking news"
    );
  });

  it("decodes common HTML entities", () => {
    expect(cleanRssText("Markets &amp; policy &quot;shift&quot;")).toBe(
      "Markets & policy \"shift\""
    );
  });

  it("collapses repeated whitespace", () => {
    expect(cleanRssText("One\n\n   two\tthree")).toBe("One two three");
  });

  it("returns undefined when the cleaned value is empty", () => {
    expect(cleanRssText(" <br> &nbsp; ")).toBeUndefined();
  });

  it("removes ANSI escapes and unsafe terminal control characters", () => {
    expect(cleanRssText("\u001B[2JBreaking\u0000 news")).toBe("Breaking news");
  });

  it("limits the cleaned output length", () => {
    expect(cleanRssText("A".repeat(20), 10)).toBe("A".repeat(10));
  });
});
