import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { Article } from "../src/models/article.js";
import {
  FileArticleRepository,
  InMemoryArticleRepository
} from "../src/repositories/article-repository.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("article repositories", () => {
  it("uses the shared URL normalisation rules in memory", async () => {
    const repository = new InMemoryArticleRepository();
    await repository.saveProcessedArticle(
      makeArticle("https://example.com/Story?id=ABC&utm_source=rss")
    );

    await expect(
      repository.hasProcessedUrl("https://example.com/Story?id=ABC#section")
    ).resolves.toBe(true);
    await expect(
      repository.hasProcessedUrl("https://example.com/story?id=abc")
    ).resolves.toBe(false);
  });

  it("persists processed URLs for a separate repository instance", async () => {
    const directory = await createTemporaryDirectory();
    const filePath = join(directory, "processed-articles.json");
    const firstRun = new FileArticleRepository(filePath);
    await firstRun.saveProcessedArticle(
      makeArticle("https://example.com/story?utm_campaign=morning")
    );

    const secondRun = new FileArticleRepository(filePath);

    await expect(
      secondRun.hasProcessedUrl("https://example.com/story#latest")
    ).resolves.toBe(true);
    await expect(secondRun.getRecentProcessedUrls()).resolves.toEqual([
      "https://example.com/story"
    ]);
  });

  it("returns no recent URLs when the requested limit is zero", async () => {
    const repository = new InMemoryArticleRepository();
    await repository.saveProcessedArticle(makeArticle("https://example.com/story"));

    await expect(repository.getRecentProcessedUrls(0)).resolves.toEqual([]);
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "morningbrief-repository-"));
  temporaryDirectories.push(directory);
  return directory;
}

function makeArticle(url: string): Article {
  return {
    id: "article-1",
    title: "Example headline",
    url,
    source: "Example News",
    publishedAt: new Date("2026-07-28T01:00:00.000Z")
  };
}
