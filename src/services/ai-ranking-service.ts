import type { Article } from "../models/article.js";
import type { RankingAssessment } from "../models/ranking-assessment.js";
import { createRankingRequest } from "../models/ranking-request.js";
import type { RankingProvider } from "./ranking-provider.js";
import { validateRankingResponse } from "./ranking-response-validator.js";

export class AiRankingService {
  public constructor(private readonly provider: RankingProvider) {}

  public async assess(
    candidates: readonly Article[]
  ): Promise<RankingAssessment[]> {
    if (candidates.length === 0) {
      return [];
    }

    const request = createRankingRequest(candidates);
    const externalResponse = await this.provider.rank(request);

    return validateRankingResponse(candidates, externalResponse);
  }
}
