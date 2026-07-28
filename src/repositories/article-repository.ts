import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Article } from "../models/article.js";
import { normaliseArticleUrl } from "../utils/url-normaliser.js";

export interface ArticleRepository {
  hasProcessedUrl(url: string): Promise<boolean>;
  saveProcessedArticle(article: Article): Promise<void>;
  getRecentProcessedUrls(limit?: number): Promise<string[]>;
}

export class InMemoryArticleRepository implements ArticleRepository {
  private readonly processedByUrl = new Map<string, Article>();

  public async hasProcessedUrl(url: string): Promise<boolean> {
    return this.processedByUrl.has(requireNormalisedUrl(url));
  }

  public async saveProcessedArticle(article: Article): Promise<void> {
    this.processedByUrl.set(requireNormalisedUrl(article.url), article);
  }

  public async getRecentProcessedUrls(limit = 100): Promise<string[]> {
    validateLimit(limit);
    return limit === 0
      ? []
      : Array.from(this.processedByUrl.keys()).slice(-limit);
  }
}

export class FileArticleRepository implements ArticleRepository {
  private processedUrls: string[] | undefined;

  public constructor(private readonly filePath: string) {}

  public async hasProcessedUrl(url: string): Promise<boolean> {
    const processedUrls = await this.loadProcessedUrls();
    return processedUrls.includes(requireNormalisedUrl(url));
  }

  public async saveProcessedArticle(article: Article): Promise<void> {
    const processedUrls = await this.loadProcessedUrls();
    const normalisedUrl = requireNormalisedUrl(article.url);

    if (processedUrls.includes(normalisedUrl)) {
      return;
    }

    processedUrls.push(normalisedUrl);
    await this.persist(processedUrls);
  }

  public async getRecentProcessedUrls(limit = 100): Promise<string[]> {
    validateLimit(limit);

    const processedUrls = await this.loadProcessedUrls();
    return limit === 0 ? [] : processedUrls.slice(-limit);
  }

  private async loadProcessedUrls(): Promise<string[]> {
    if (this.processedUrls) {
      return this.processedUrls;
    }

    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(contents);

      if (
        !Array.isArray(parsed) ||
        !parsed.every((value) => typeof value === "string" && normaliseArticleUrl(value))
      ) {
        throw new Error("expected an array of valid HTTP(S) URLs");
      }

      this.processedUrls = Array.from(
        new Set(parsed.map((url) => requireNormalisedUrl(url)))
      );
    } catch (error) {
      if (isFileNotFoundError(error)) {
        this.processedUrls = [];
      } else {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Could not load processed article repository at ${this.filePath}: ${message}`,
          { cause: error }
        );
      }
    }

    return this.processedUrls;
  }

  private async persist(processedUrls: string[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;

    await writeFile(temporaryPath, `${JSON.stringify(processedUrls, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

function requireNormalisedUrl(url: string): string {
  const normalisedUrl = normaliseArticleUrl(url);

  if (!normalisedUrl) {
    throw new Error(`Invalid article URL: ${url}`);
  }

  return normalisedUrl;
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function validateLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("Processed article URL limit must be a non-negative integer");
  }
}
