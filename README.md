# AgentRadar

An open-source trend radar and research workbench for the AI agent ecosystem.

English · [中文](./README.zh-CN.md)

---

## What this is

AgentRadar continuously collects public signals from the agent ecosystem, normalizes them, scores projects, synthesizes weekly trends, builds knowledge cards, and turns the results into a local artifact set that is easy to browse, verify, and reuse.

You can think of it as an open-source radar system for researchers, developers, investors, product teams, and agent builders:

- It is not a chatbot. It is a repeatable data and analysis pipeline.
- It is not a black-box recommendation engine. It tries to preserve evidence, score components, and trend reasoning.
- It does not only track one-day heat. It also tracks persistence and week-level movement.

If you often ask questions like these, this project is for you:

- Which agent projects are most worth looking at today?
- Which repositories are just one-day hype, and which ones are building momentum?
- What directions actually formed into trends this week?
- Which new projects are worth watching before they hit the main board?
- Why did a project rank highly, and what evidence supports that?

---

## Why it is worth a Star

Many people can scrape GitHub Trending once. The hard part comes after that:

- How do you align signals from multiple sources?
- How do you balance same-day heat with long-term persistence?
- How do you keep weekly trend judgments interpretable?
- How do you notice emerging projects before they become obvious?
- How do you turn all of that into stable daily and weekly outputs?

AgentRadar connects those steps into one complete workflow and saves the result as inspectable artifacts instead of stopping at “this feels hot.”

If this kind of open-source research infrastructure is useful to you, please consider starring this repository. We are also deeply grateful to the public data sources and open ecosystems behind it. If they help you, please consider starring them too.

---

## What it does

### 1. Daily trend radar

The system aggregates multiple public sources and produces a daily project board, score outputs, evidence summaries, and run health artifacts.

You get:

- `data/reports/YYYY-MM-DD.daily.json`
- `data/reports/YYYY-MM-DD.daily.md`
- `data/reports/YYYY-MM-DD.run-summary.json`
- `data/reports/YYYY-MM-DD.verify-daily.json`

### 2. Weekly trend synthesis

The system organizes a 7-day window of project behavior, topic clusters, evidence relationships, and rule judgments into a weekly trend view.

You get:

- `data/reports/YYYY-MM-DD.weekly.json`
- `data/reports/YYYY-MM-DD.weekly.md`
- `data/reports/YYYY-MM-DD.weekly.judgment.json`
- `data/reports/YYYY-MM-DD.weekly.audit.json`

### 3. Knowledge card generation

High-value projects are turned into reusable knowledge cards for long-term indexing and review.

You get:

- `data/kb/latest.json`
- `data/kb/*.md`

### 4. Emerging-project observer

Besides the main board, the system also watches for “not mature yet, but worth tracking” projects and surfaces them in a dedicated observer view.

You get:

- `data/observer/ecosystem-focus/*.json`

### 5. Local read-only workbench

The OSS edition ships with a lightweight local web console for browsing generated artifacts, but it **does not include login, registration, sessions, or account management**.

---

## The agents inside the system

This is not “one agent.” It is a set of scoped agents and workflows that work together.

### 1. Signal Collection Agent

Responsibilities:

- Pull raw signals from public sources
- Handle basic source differences
- Write to `data/raw/`

Related capabilities:

- upstream digest reads from `agents-radar`
- Trendshift snapshot reads
- GitHub Trending, live metrics, and watchlist activity enrichment

### 2. Normalization & Scoring Agent

Responsibilities:

- Convert raw signals into a unified structure
- Score projects with explicit rules
- Produce interpretable ranking outputs

Related outputs:

- `data/normalized/`
- `data/scores/`
- `data/classifications/`

### 3. Daily Report Agent

Responsibilities:

- Produce the daily main board
- Organize project summaries, why-it-matters notes, risks, and suggested actions
- Generate the daily report and run summary

Related code:

- `src/action/dailyReport.ts`
- `src/action/runSummary.ts`
- `src/action/dailyVerification.ts`

### 4. Weekly Trend Review Agent

Responsibilities:

- Identify real trends across the weekly window
- Review which candidate trends should be kept, merged, split, or downgraded
- Produce a weekly output that is more useful for research judgment

Related code:

- `src/action/weeklyJudgmentRules.ts`
- `src/action/weeklyEnhancement.ts`
- `src/action/weeklyTrendAgent.ts`
- `src/action/weeklyReport.ts`

### 5. Observer Agent

Responsibilities:

- Look beyond the main board
- search the wider agent ecosystem for promising repositories
- build an observation pool for projects that are early but worth tracking

Related code:

- `src/signal/ecosystemFocusObserver.ts`

### 6. Knowledge Card Agent

Responsibilities:

- Turn projects into durable knowledge cards
- Support project dossiers, research indexing, and reuse

Related code:

- `src/action/knowledgeCard.ts`

### 7. Agent Memory Workflow

Responsibilities:

- Record part of the development-task and workflow context
- Make the project itself easier to evolve and automate over time

Related code:

- `src/agentMemory/`

Notes:

- This is an internal workflow capability, not a public login-based product feature.
- The OSS edition keeps these files, but it does not include any end-user authentication system.

---

## Data source acknowledgements

This project benefits heavily from the open-source community and public data sources. Special thanks to:

- [agents-radar](https://github.com/duanyytop/agents-radar)
- [Trendshift](https://trendshift.io)
- [GitHub](https://github.com)
- the broader ecosystem of open-source agent builders and maintainers

If these upstream projects, platforms, and public ecosystems help you, please consider giving them a Star, and please consider starring AgentRadar too.

---

## Ecosystem directions it watches

The current configuration focuses on directions like:

- coding agents
- agent runtime
- skills / tools / MCP
- memory / knowledge
- browser / computer use
- eval / observability / governance
- multi-agent coordination
- agent UI / workbench

These directions come from repository rules and configuration, not from vague prompt-only intuition.

---

## Repository structure

```text
agentRadar/
├── app/                     # OSS read-only web entry
├── data/                    # generated daily / weekly / score / KB / observer artifacts
├── scripts/                 # automation scripts
├── src/
│   ├── action/              # daily / weekly / KB core workflows
│   ├── agentMemory/         # agent memory workflows
│   ├── db/                  # database foundations
│   ├── filter/              # scoring and filtering
│   ├── providers/           # LLM provider adapters
│   ├── signal/              # source ingestion and aggregation
│   ├── storage/             # file IO
│   └── visualConsole/       # console data building
├── README.md                # English
├── README.zh-CN.md          # primary Chinese document
```

---

## Quick start

### 1. Install dependencies

```bash
corepack pnpm install
```

### 2. Prepare environment variables

```bash
cp .env.example .env
```

Notes:

- If you only want to browse committed artifacts, you may not need any provider key at all.
- If you want LLM-enhanced workflows, add the provider keys you need.

### 3. Start the local web console

```bash
corepack pnpm visual-console:web
```

Default address:

- `http://127.0.0.1:3210`

### 4. Use the CLI view directly

```bash
corepack pnpm visual-console -- --view overview --date latest
```

---

## Common commands

### Daily workflows

```bash
corepack pnpm run-daily
corepack pnpm verify-daily
corepack pnpm score
```

### Weekly workflows

```bash
corepack pnpm run-weekly
corepack pnpm sync-weekly
```

### Other commands

```bash
corepack pnpm capture-github-stars
corepack pnpm build-kb
corepack pnpm typecheck
corepack pnpm test
```

---

## How artifacts flow

A common path looks like this:

1. collect raw signals into `data/raw/`
2. normalize them into `data/normalized/`
3. classify and score them into `data/classifications/` and `data/scores/`
4. generate daily reports, weekly reports, observer outputs, and KB outputs into `data/reports/`, `data/observer/`, and `data/kb/`
5. browse the outputs through the CLI or local web console

This means you can use the project both as a local research tool and as a repeatable artifact generator.

---

## OSS boundary

To avoid exposing configuration, secrets, and private attack surfaces, the current OSS edition explicitly excludes:

- login
- registration
- OAuth
- sessions / account settings
- local auth bootstrap flows
- private deployment templates
- private operational docs
- `.env` / `.env.local`

In other words, the OSS edition is a **no-login, read-only browsing, data-workflow-capable** public version.

---

## FAQ

### 1. Who is this project for?

It is a good fit for:

- researchers tracking the agent ecosystem
- developers who want to monitor momentum over time
- teams who want structured artifacts from public signals
- builders who want to adapt the stack into their own radar workflows

### 2. Does this project require a database?

No.

The current path is primarily artifact-driven, so you can browse and run most public workflows without standing up a database first. Some DB modules remain for workflow compatibility, but they do not mean you must enable database-backed auth infrastructure to use the project.

### 3. Why is the web console read-only?

That is an intentional safety boundary. The OSS edition does not expose a user system or any login path, which makes it safer and easier to maintain.

### 4. Can I adapt this into my own internal radar?

Yes. Common ways to do that include:

- editing `config.yaml`
- replacing or extending data sources
- adjusting scoring rules
- wiring it into your own automation flow

### 5. Can I adapt this into my own version?

Yes. Common ways to do that include:

- editing `config.yaml`
- replacing or extending data sources
- adjusting scoring rules
- wiring the CLI and artifacts into your own automation stack

---

## Contributing

Contributions are welcome:

- open issues for bugs
- open PRs for README, rules, data sources, and workflows
- suggest new ecosystem directions or observation dimensions

If you plan to maintain your own long-lived fork, define your own safety boundary early before deciding which capabilities should stay read-only and which ones should be exposed.

---

## Star History

If this project helps you, please give it a Star.

And if you know other people working on agent ecosystems, trend research, open-source intelligence, or workflow automation, feel free to share it with them.
