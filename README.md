# MorningBrief AI

MorningBrief AI is a TypeScript and Node.js project for building an agentic morning news briefing system. The planned system will collect news published overnight, rank the most important developments, select the top five stories, summarise them, and produce a concise morning briefing.

This first version only creates the project foundation. It does not call paid APIs, run an LLM, or implement a production news pipeline yet.

## Planned Workflow

1. Load application settings from environment variables.
2. Calculate the overnight news window.
3. Collect articles from RSS feeds or future news tools.
4. Filter invalid, duplicate, old, and previously processed articles.
5. Rank stories by significance, recency, credibility, confirmation, relevance, and penalties.
6. Generate no more than five briefing items.
7. Deliver the briefing to the console, email, Telegram, or a dashboard.

## Repository Structure

```text
morningbrief-ai/
├── prompts/       # Version-controlled agent prompts
├── data/          # Local development data
├── src/
│   ├── agents/       # Agent instructions and orchestration boundaries
│   ├── collectors/   # RSS and future external news collectors
│   ├── config/       # Environment loading and validation
│   ├── delivery/     # Console, email, Telegram, or dashboard output
│   ├── models/       # TypeScript types and Zod schemas
│   ├── repositories/ # Persistence abstractions
│   ├── services/     # Deterministic application logic
│   └── utils/        # Shared utilities
├── scripts/       # Developer scripts
└── tests/         # Unit tests
```

## Technology Choices

- Node.js 20 or later for the runtime.
- TypeScript with strict checking for safer refactoring.
- ES modules for modern Node.js module loading.
- Zod for runtime schema validation.
- Vitest for fast unit tests.
- Axios and `rss-parser` for future RSS and HTTP collection work.
- dotenv for environment variables.
- tsx for running TypeScript during development.

## Requirements

- Node.js 20 or later
- npm

Check your versions:

```bash
node --version
npm --version
```

## Clone the Repository

```bash
git clone <repository-url>
cd morningbrief-ai
```

## Install Dependencies

```bash
npm install
```

## Environment Setup

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

The placeholder version runs without `OPENAI_API_KEY`. That key will become required once AI summarisation is enabled.

## Run the Project

Run the main workflow in watch mode:

```bash
npm run dev
```

Run the briefing script once:

```bash
npm run run:briefing
```

After building, run the compiled application:

```bash
npm run build
npm start
```

## Test, Type-Check, and Build

```bash
npm test
npm run typecheck
npm run build
```

## Agents, Tools, and Deterministic Services

An agent decides how to pursue a goal using instructions, context, and tools. In this project, the future Morning News Researcher agent will decide which developments matter and how to summarise them.

A tool is something an agent or service can call to retrieve information or perform an action. RSS collection, a news API, email delivery, and Telegram delivery are examples of future tools.

A deterministic service is normal application code that should behave predictably for the same inputs. Filtering, duplicate detection, and placeholder ranking belong here because they should be easy to test without an LLM.

## Why Start With One Agent

The first production version should use a single agent because the workflow is still small: inspect articles, group related reports, rank developments, and write the briefing. Multiple agents can add coordination overhead before the ranking and evaluation rules are proven. Specialist agents can be introduced later if the single-agent workflow becomes hard to evaluate or maintain.

## Future Delivery Channels

The current delivery target is the console. Later versions may add:

- Email delivery for daily inbox briefings.
- Telegram delivery for mobile alerts.
- A web dashboard for browsing past briefings and saved articles.

## Development Phases

1. Project foundation
2. RSS news collection
3. Filtering and duplicate detection
4. AI ranking and summarisation
5. Briefing delivery
6. Daily scheduling
7. Evaluation and reliability improvements
