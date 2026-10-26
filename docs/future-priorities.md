# Future priorities and LLM Trading Lab assessment

Recorded: 2026-10-26 (Asia/Jakarta).
Status: priorities 1-3 implemented on 2026-10-26 within the documented provider limits; see [implementation and usage](holdings-and-research.md). AI and LLM Trading Lab integration remain future work.

## 1. Holdings monitoring and exit alerts

- Record actual entry date, filled price, quantity, fees, partial exits and remaining holdings.
- Evaluate updated prices against the deterministic stop, target, trend and time-exit rules.
- Show plain-language HOLD/SELL/WAIT cards with source time, reason, estimated proceeds and costs.
- Investigate Arjum batch prices and price freshness before choosing a monitoring cadence. Respect per-symbol quota costs; do not promise realtime monitoring from an end-of-day feed.
- Persist alert events and prevent duplicates. Notification delivery/channel remains a later design choice.
- Gate: stale/missing data cannot create actionable alerts; test gaps, partial fills, repeated refreshes and closed sessions. Alerts do not place brokerage orders.

## 2. Broker and foreign-flow context

- Integrate broker summaries, historical accumulation and foreign/domestic breakdowns for shortlisted candidates.
- Display dated net buying/selling context in Bahasa Indonesia with explicit missing-data states.
- Treat flows as supporting observations, not proof of future price direction or a standalone BUY.
- Gate: validate units, sign conventions, coverage, release timing and quota. Compare strategy results with and without these features on untouched periods before changing ranking rules.

## 3. Financial-health checks

- Integrate Arjum financial statements; show readable profitability, debt and cash-flow flags where the data supports them.
- Use sector-appropriate definitions and explain unavailable or non-comparable ratios.
- Gate: validate reporting periods, units, publication timestamps and revisions. Historical tests must use information available on each decision date, not subsequently released accounts.

## Possible combination with LLM Trading Lab

Reference: https://github.com/LuckyOne7777/LLM-Trading-Lab
Assessment based on its public README inspected on 2026-10-26; not a source-code audit or an integration.

The repository describes a live US micro-cap experiment, Python tooling, yfinance/Stooq data, portfolio accounting, stop-loss handling, decision logs and benchmark/risk analytics. These are useful research references; its results do not establish an edge for Indonesian stocks or our 3-15-session strategy.

Recommended adaptation:

1. Keep Nuxt/Vue, Arjum, IDR and our deterministic engine as the application core.
2. Add append-only decision and trade journals, daily equity snapshots, drawdowns and benchmark comparisons.
3. Optionally add an AI explanation/research layer over dated, validated data. Numerical levels, lots and risk limits remain deterministic; the AI cannot bypass data-quality or portfolio rules.
4. Evaluate any AI-proposed selection in a separate paper experiment against the existing baseline with identical universe, dates, capital, fees and execution assumptions.
5. If Python evaluation tools are useful, run them separately from Vercel web requests and import versioned reports into the app.

Before copying or integrating code, inspect actual modules, dependency/security requirements and license permissions at a pinned commit. No license permission was established during this README review. Adapt provider schemas, trading calendar, lot/tick rules, fees, corporate actions and local benchmark treatment. Verify any automated stop handling in source before relying on it.

Implementation order: priority 1 and journal foundation, then priorities 2 and 3, followed by controlled comparisons. A language model remains optional; retain a free deterministic path and explicitly budget any model usage.

No upstream code was copied, dependencies installed, AI service connected or trading automation enabled by this note.

## Optional free AI explanations (future update)

- Evaluate Qwen3 4B/8B or Gemma 3 through local Ollama after checking available RAM/GPU and Bahasa Indonesia explanation quality.
- Local inference has no per-request paid API credits, but needs running hardware. Keep deterministic template explanations as the offline/default fallback.
- A Vercel-hosted app needs a separate secured inference service or explanations generated locally and uploaded; deployment does not automatically host a local model.
- A hosted free-tier API is an alternative only after verifying current quotas, data-use terms and costs. No paid inference or model download is authorized by this backlog entry.
- AI explains validated signals; prices, quantities and risk constraints remain deterministic.
