import OpenAI from "openai";
import type { NewsCollector } from "../src/collectors/news-collector.js";
import { RssCollector } from "../src/collectors/rss-collector.js";
import {
  loadAiRankingDiagnosticSettings,
  type AiRankingDiagnosticSettings
} from "../src/config/ai-ranking-diagnostic-settings.js";
import { rssFeeds } from "../src/config/rss-feeds.js";
import { loadSettings } from "../src/config/settings.js";
import { calculateNewsWindow, isMainModule } from "../src/index.js";
import type { Article } from "../src/models/article.js";
import type { RankingAssessment } from "../src/models/ranking-assessment.js";
import { InMemoryArticleRepository } from "../src/repositories/article-repository.js";
import { AiRankingService } from "../src/services/ai-ranking-service.js";
import type { AiRankingServicePort } from "../src/services/ai-briefing-candidate-ranker.js";
import { ArticleFilter } from "../src/services/article-filter.js";
import { ArticleRanker } from "../src/services/article-ranker.js";
import { HeadlineDeduplicator } from "../src/services/headline-deduplicator.js";
import { OpenAiRankingProvider } from "../src/services/openai-ranking-provider.js";
import { loadRankingPrompt } from "../src/services/ranking-prompt-loader.js";

export type { AiRankingServicePort } from "../src/services/ai-briefing-candidate-ranker.js";

interface BriefingWindowSettings {
  userTimezone: string;
  briefingHour: number;
  newsLookbackHours: number;
}

export interface AiRankingDiagnosticRuntimeSettings
  extends BriefingWindowSettings {
  openAiRankingModel: string;
  aiRankingMaxCandidates: number;
}

export interface AiRankingDiagnosticOptions {
  now?: Date;
  settings: AiRankingDiagnosticRuntimeSettings;
  collector: NewsCollector;
  aiRankingService: AiRankingServicePort;
}

export interface AiRankingDiagnosticCommandOptions {
  now?: Date;
  appSettings?: BriefingWindowSettings;
  diagnosticSettings?: AiRankingDiagnosticSettings;
  collector?: NewsCollector;
  promptLoader?: () => Promise<string>;
  aiRankingServiceFactory?: (
    settings: AiRankingDiagnosticSettings,
    rankingPrompt: string
  ) => AiRankingServicePort;
}

export interface AiRankingDiagnosticReport {
  generatedAt: string;
  model: string;
  window: {
    startTime: string;
    endTime: string;
  };
  counts: {
    collected: number;
    filtered: number;
    ranked: number;
    exactHeadlineDeduplicated: number;
    submittedForAiRanking: number;
    excludedByDiagnosticLimit: number;
  };
  candidates: AiRankingDiagnosticCandidate[];
  assessments: AiRankingDiagnosticAssessment[];
  aiRanking: AiRankingDiagnosticRankedAssessment[];
}

interface AiRankingDiagnosticCandidate {
  candidateNumber: number;
  articleId: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  category?: string;
}

interface AiRankingDiagnosticAssessment {
  candidateNumber: number;
  articleId: string;
  title: string;
  source: string;
  significanceScore: number;
  confidenceScore: number;
  rationale: string;
  uncertainty?: string;
}

interface AiRankingDiagnosticRankedAssessment {
  rank: number;
  candidateNumber: number;
  articleId: string;
  title: string;
  source: string;
  significanceScore: number;
  confidenceScore: number;
}

export async function runAiRankingDiagnosticCommand(
  options: AiRankingDiagnosticCommandOptions = {}
): Promise<AiRankingDiagnosticReport> {
  const appSettings = options.appSettings ?? loadSettings();
  const diagnosticSettings =
    options.diagnosticSettings ?? loadAiRankingDiagnosticSettings();
  const rankingPrompt = await (options.promptLoader ?? loadRankingPrompt)();
  const aiRankingService =
    options.aiRankingServiceFactory?.(diagnosticSettings, rankingPrompt) ??
    createAiRankingService(diagnosticSettings, rankingPrompt);

  return inspectAiRanking({
    now: options.now,
    settings: {
      userTimezone: appSettings.userTimezone,
      briefingHour: appSettings.briefingHour,
      newsLookbackHours: appSettings.newsLookbackHours,
      openAiRankingModel: diagnosticSettings.openAiRankingModel,
      aiRankingMaxCandidates: diagnosticSettings.aiRankingMaxCandidates
    },
    collector: options.collector ?? new RssCollector(rssFeeds),
    aiRankingService
  });
}

export async function inspectAiRanking(
  options: AiRankingDiagnosticOptions
): Promise<AiRankingDiagnosticReport> {
  const now = options.now ?? new Date();
  const { startTime, endTime } = calculateNewsWindow(
    options.settings.newsLookbackHours,
    now,
    options.settings.userTimezone,
    options.settings.briefingHour
  );
  const repository = new InMemoryArticleRepository();
  const filter = new ArticleFilter(repository);
  const ranker = new ArticleRanker();
  const headlineDeduplicator = new HeadlineDeduplicator();

  let collected: Article[];
  try {
    collected = await options.collector.collect(startTime, endTime);
  } catch (error) {
    throw new Error(`RSS collection failed: ${getErrorMessage(error)}`, {
      cause: error
    });
  }

  const filtered = await filter.filter(collected, startTime, endTime);
  const ranked = ranker.rank(filtered, endTime);
  const exactHeadlineDeduplicated = headlineDeduplicator.deduplicate(ranked);
  const submittedCandidates = exactHeadlineDeduplicated.slice(
    0,
    options.settings.aiRankingMaxCandidates
  );

  const assessments =
    submittedCandidates.length === 0
      ? []
      : await assessCandidates(options.aiRankingService, submittedCandidates);

  const candidates = submittedCandidates.map(toDiagnosticCandidate);
  const diagnosticAssessments = joinAssessmentsToCandidates(
    submittedCandidates,
    assessments
  );

  return {
    generatedAt: now.toISOString(),
    model: options.settings.openAiRankingModel,
    window: {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    },
    counts: {
      collected: collected.length,
      filtered: filtered.length,
      ranked: ranked.length,
      exactHeadlineDeduplicated: exactHeadlineDeduplicated.length,
      submittedForAiRanking: submittedCandidates.length,
      excludedByDiagnosticLimit:
        exactHeadlineDeduplicated.length - submittedCandidates.length
    },
    candidates,
    assessments: diagnosticAssessments,
    aiRanking: createAiRankingView(diagnosticAssessments)
  };
}

function createAiRankingService(
  settings: AiRankingDiagnosticSettings,
  rankingPrompt: string
): AiRankingService {
  const client = new OpenAI({ apiKey: settings.openAiApiKey });
  const provider = new OpenAiRankingProvider(
    client,
    settings.openAiRankingModel,
    rankingPrompt
  );

  return new AiRankingService(provider);
}

async function assessCandidates(
  aiRankingService: AiRankingServicePort,
  candidates: readonly Article[]
): Promise<RankingAssessment[]> {
  try {
    return await aiRankingService.assess(candidates);
  } catch (error) {
    const message = getErrorMessage(error);

    if (message.startsWith("Invalid ranking response")) {
      throw new Error(`Response-contract validation failed: ${message}`, {
        cause: error
      });
    }

    if (message.startsWith("OpenAI ranking response")) {
      throw new Error(`Invalid OpenAI output: ${message}`, { cause: error });
    }

    throw new Error(`AI ranking provider failed: ${message}`, { cause: error });
  }
}

function toDiagnosticCandidate(
  article: Article,
  index: number
): AiRankingDiagnosticCandidate {
  return {
    candidateNumber: index + 1,
    articleId: article.id,
    title: article.title,
    source: article.source,
    url: article.url,
    publishedAt: article.publishedAt.toISOString(),
    ...(article.category === undefined ? {} : { category: article.category })
  };
}

function joinAssessmentsToCandidates(
  candidates: readonly Article[],
  assessments: readonly RankingAssessment[]
): AiRankingDiagnosticAssessment[] {
  const assessmentsByArticleId = new Map<string, RankingAssessment>();

  for (const assessment of assessments) {
    if (assessmentsByArticleId.has(assessment.articleId)) {
      throw new Error(
        `AI ranking service returned duplicate assessment for article ID "${assessment.articleId}"`
      );
    }

    assessmentsByArticleId.set(assessment.articleId, assessment);
  }

  return candidates.map((candidate, index) => {
    const assessment = assessmentsByArticleId.get(candidate.id);

    if (assessment === undefined) {
      throw new Error(
        `AI ranking service returned no assessment for article ID "${candidate.id}"`
      );
    }

    return {
      candidateNumber: index + 1,
      articleId: candidate.id,
      title: candidate.title,
      source: candidate.source,
      significanceScore: assessment.significanceScore,
      confidenceScore: assessment.confidenceScore,
      rationale: assessment.rationale,
      ...(assessment.uncertainty === undefined
        ? {}
        : { uncertainty: assessment.uncertainty })
    };
  });
}

function createAiRankingView(
  assessments: readonly AiRankingDiagnosticAssessment[]
): AiRankingDiagnosticRankedAssessment[] {
  return assessments
    .map((assessment) => ({ ...assessment }))
    .sort((left, right) => {
      const significanceDifference =
        right.significanceScore - left.significanceScore;
      if (significanceDifference !== 0) {
        return significanceDifference;
      }

      const confidenceDifference = right.confidenceScore - left.confidenceScore;
      if (confidenceDifference !== 0) {
        return confidenceDifference;
      }

      return left.candidateNumber - right.candidateNumber;
    })
    .map((assessment, index) => ({
      rank: index + 1,
      candidateNumber: assessment.candidateNumber,
      articleId: assessment.articleId,
      title: assessment.title,
      source: assessment.source,
      significanceScore: assessment.significanceScore,
      confidenceScore: assessment.confidenceScore
    }));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (isMainModule(import.meta.url)) {
  try {
    const report = await runAiRankingDiagnosticCommand();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(`AI ranking diagnostic failed: ${getErrorMessage(error)}`);
    process.exitCode = 1;
  }
}
