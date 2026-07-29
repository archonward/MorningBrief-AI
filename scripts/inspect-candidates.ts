import type { NewsCollector } from "../src/collectors/news-collector.js";
import { RssCollector } from "../src/collectors/rss-collector.js";
import { rssFeeds } from "../src/config/rss-feeds.js";
import { loadSettings } from "../src/config/settings.js";
import {
  createCandidatePairDiagnostics,
  type CandidatePairDiagnostic
} from "../src/diagnostics/candidate-pair-diagnostics.js";
import { calculateNewsWindow, isMainModule } from "../src/index.js";
import { InMemoryArticleRepository } from "../src/repositories/article-repository.js";
import { ArticleFilter } from "../src/services/article-filter.js";
import { ArticleRanker } from "../src/services/article-ranker.js";
import {
  HeadlineDeduplicator,
  createHeadlineFingerprint
} from "../src/services/headline-deduplicator.js";

interface CandidateInspectionSettings {
  userTimezone: string;
  briefingHour: number;
  newsLookbackHours: number;
}

export interface CandidateInspectionOptions {
  now?: Date;
  settings?: CandidateInspectionSettings;
  collector?: NewsCollector;
}

export interface CandidateSnapshot {
  generatedAt: string;
  window: {
    startTime: string;
    endTime: string;
  };
  counts: {
    collected: number;
    filtered: number;
    ranked: number;
    exactHeadlineDeduplicated: number;
  };
  candidates: CandidateSnapshotArticle[];
  pairDiagnostics: CandidatePairDiagnostic[];
}

interface CandidateSnapshotArticle {
  title: string;
  fingerprint: string;
  description?: string;
  source: string;
  url: string;
  publishedAt: string;
  category?: string;
  importanceScore?: number;
}

export async function inspectCandidates(
  options: CandidateInspectionOptions = {}
): Promise<CandidateSnapshot> {
  const now = options.now ?? new Date();
  const settings = options.settings ?? loadSettings();
  const { startTime, endTime } = calculateNewsWindow(
    settings.newsLookbackHours,
    now,
    settings.userTimezone,
    settings.briefingHour
  );
  const collector = options.collector ?? new RssCollector(rssFeeds);
  const repository = new InMemoryArticleRepository();
  const filter = new ArticleFilter(repository);
  const ranker = new ArticleRanker();
  const headlineDeduplicator = new HeadlineDeduplicator();

  const collected = await collector.collect(startTime, endTime);
  const filtered = await filter.filter(collected, startTime, endTime);
  const ranked = ranker.rank(filtered, endTime);
  const candidates = headlineDeduplicator.deduplicate(ranked);

  return {
    generatedAt: now.toISOString(),
    window: {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    },
    counts: {
      collected: collected.length,
      filtered: filtered.length,
      ranked: ranked.length,
      exactHeadlineDeduplicated: candidates.length
    },
    candidates: candidates.map((article) => ({
      title: article.title,
      fingerprint: createHeadlineFingerprint(article.title),
      description: article.description,
      source: article.source,
      url: article.url,
      publishedAt: article.publishedAt.toISOString(),
      category: article.category,
      importanceScore: article.importanceScore
    })),
    pairDiagnostics: createCandidatePairDiagnostics(candidates)
  };
}

if (isMainModule(import.meta.url)) {
  try {
    const snapshot = await inspectCandidates();
    console.log(JSON.stringify(snapshot, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Candidate inspection failed: ${message}`);
    process.exitCode = 1;
  }
}
