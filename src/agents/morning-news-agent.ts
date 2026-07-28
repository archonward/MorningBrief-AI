import type { MorningBriefing } from "../models/briefing.js";

export interface MorningNewsAgentInput {
  timeWindowStart: Date;
  timeWindowEnd: Date;
}

export interface MorningNewsAgent {
  run(input: MorningNewsAgentInput): Promise<MorningBriefing>;
}

export const morningNewsAgentPromptPath = "prompts/morning-news-agent.md";
