# SwingLab

Personal Indonesian stock research app. Vue/Nuxt frontend, private server API, persistent SQLite locally and optional remote libSQL for hosting. Educational paper-trading workflow; no brokerage execution.

## Run locally

Requires Node 22.18+ (Node 24 recommended). The task launcher automatically uses the compatible bundled Codex runtime when the system Node is older and that runtime is available. Dependencies are installed in this checkout.

```sh
npm install
npm run dev
```

Open the local URL printed by Nuxt. Keep `ARJUM_API_KEY` in `.env`. Never put this key in public runtime configuration. Local dev binds to 127.0.0.1. `.env`, local database, reports and provider snapshots are ignored by Git.

```sh
npm test
npm run typecheck
npm run backtest
npm run build
```

The backtest reads the validation snapshots already saved in `docs/arjum-samples.json` and `docs/arjum-extra-samples.json`; it writes `data/backtest-report.json`. A clean checkout needs a fresh validation snapshot before backtesting. scripts/validate-arjum.ps1 acquires both the primary sample and the IHSG snapshot. The dashboard reads the report after reload. Backtests are local jobs, not web requests.

## Current scope

- Broad discovery through the Arjum stock catalogue (up to 25 pages), with up to 60 stocks selected by latest-session turnover proxy. Held symbols take priority. IHSG is the benchmark. The UI discloses partial scan coverage.
- Market history is cached in `data/arus.db`. Catalogue/index failures keep the previous snapshot. Individual history failures are explicitly marked and cannot produce actionable signals; stale rows are not reused silently.
- Refresh limited to once per hour, with a 400-request WIB daily budget. Each scan reserves up to 86 requests (25 catalogue pages, IHSG, 60 stocks); reservations are conservative and not refunded. One migration scan can immediately replace the legacy four-stock cache without resetting accumulated usage. Restarts do not reset the budget.
- Saved capital/risk settings and holdings persist in SQLite. Capital is available cash; equity includes cash and marked positions, entered by the user.
- BUY is a conditional next-session stop-entry, not an instruction to buy immediately. Skip opening gaps over 3%; recalculate position size for actual fills. Orders expire after one session.
- Positions are rounded down to 100-share lots, with fee/slippage allowances, liquidity participation, cash, position and aggregate risk limits. Missing stops reserve full held value as risk.
- Stops/trend exits may occur earlier than three sessions. New positions use a configurable 3–15-session horizon; the purchase session counts as day 1 and the time exit targets session N's open. Existing positions without a saved horizon retain 15 sessions. Adding shares or selling part of a position preserves its original schedule.
- Manual AI review provides Deep Research, Starting Plan and Daily Check-in prompts from saved data, with preview and copy. Portfolio sharing is opt-in; no AI key or automated AI request is required. See [manual AI workflow and test checklist](docs/manual-ai-workflow.md).
- All signal logic is deterministic, versioned and shared with the backtester. Qualifying setups are ranked before capital allocation using relative strength, relative volume and trend distance. Scores are uncalibrated ordering heuristics, not win probabilities; ties use alphabetical order.

## Research limitations

Current sample checks are not full market-data certification. Corporate-action methodology, dividend treatment, historical price limits and historical universe membership are unverified. Backtests are explicitly exploratory and do not demonstrate profitability. The fixed four-stock universe has selection/survivorship bias. No parameter tuning was performed against holdout results.

Signals require the expected completed exchange session at/after 18:00 WIB; before then they require the preceding session. The exchange calendar currently covers 2026, including listed holidays; unsupported calendar coverage blocks live decisions rather than guessing dates. Missing and stale records block trade decisions. Zero-volume or locked candles cannot be assumed executable in simulation. A stop is not a guaranteed maximum loss.

Backtests outside verified calendar coverage explicitly count observed IHSG sessions. Missing historical sessions can therefore affect elapsed holding periods; no future calendar date is inferred in this mode. Within verified coverage, known sessions count even when a data bar is missing, but a simulated fill still requires an executable stock bar.

Global/yield data, news catalysts, full exchange breadth and scheduled briefs are future phases. An actual-fill journal, in-app exit monitoring, and on-demand broker/financial research are now available; see [holdings and research](docs/holdings-and-research.md). No fabricated data is displayed for unavailable sections.

## Vercel preparation (not deployed)

Set ARJUM_API_KEY, DATABASE_URL and DATABASE_AUTH_TOKEN through the deployment environment. Use a persistent hosted libSQL database, not a file URL. Set APP_PASSWORD to protect the whole app with browser Basic authentication (any username). The app fails closed on Vercel without access credentials and requires a database URL. All hosted traffic must use HTTPS. No secrets are compiled into Nuxt public config.

Nuxt detects the Vercel build environment. Scheduling/deployment configuration is not included in this phase. Import/recreate research reports separately on hosted storage; local backtest files are not automatically deployed.

Zero balances: cash and equity can both be 0. The planner allocates no new buys in that state. Cash must remain no greater than total equity; negative values are rejected. Backtest scenarios still require positive starting capital to calculate meaningful returns.


See docs/universe-expansion.md for coverage, ranking formula and the distinction between current scanning and the older four-stock backtest.

See [future priorities](docs/future-priorities.md) for the Arjum enhancement history, optional local AI, and the LLM Trading Lab integration assessment.

