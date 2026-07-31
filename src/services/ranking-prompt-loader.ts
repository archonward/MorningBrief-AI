import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const DEFAULT_RANKING_PROMPT_PATH = resolve(
  "prompts",
  "news-ranking-agent.md"
);

export async function loadRankingPrompt(
  promptPath = DEFAULT_RANKING_PROMPT_PATH
): Promise<string> {
  try {
    const prompt = await readFile(promptPath, "utf8");

    if (prompt.trim().length === 0) {
      throw new Error("prompt file is empty");
    }

    return prompt;
  } catch (error) {
    throw new Error(
      `Could not load AI ranking prompt at ${promptPath}: ${getErrorMessage(error)}`,
      { cause: error }
    );
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
