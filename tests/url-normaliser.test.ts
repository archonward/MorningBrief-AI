import { describe, expect, it } from "vitest";
import { normaliseArticleUrl } from "../src/utils/url-normaliser.js";

describe("normaliseArticleUrl", () => {
  it("removes tracking parameters", () => {
    const result = normaliseArticleUrl(
      "https://example.com/story?utm_source=newsletter&utm_medium=email&at_campaign=rss&fbclid=abc&id=123"
    );

    expect(result).toBe("https://example.com/story?id=123");
  });

  it("preserves necessary unknown query parameters", () => {
    const result = normaliseArticleUrl("https://example.com/story?id=123&page=2");

    expect(result).toBe("https://example.com/story?id=123&page=2");
  });

  it("removes URL fragments", () => {
    const result = normaliseArticleUrl("https://example.com/story#comments");

    expect(result).toBe("https://example.com/story");
  });

  it("returns null for invalid URLs", () => {
    expect(normaliseArticleUrl("not a url")).toBeNull();
  });
});
