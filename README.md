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

- Four-symbol pilot universe: BBCA, BBRI, TLKM, ANTM; IHSG benchmark.
- Market history is cached in `data/arus.db`; refresh requests fetch five symbols atomically. A failure keeps the prior complete cache.
- Refresh limited to once per hour and four runs per WIB day (20 API requests reserved). Failed runs consume local budget conservatively. Restarts do not reset this budget.
- Saved capital/risk settings and holdings persist in SQLite. Capital is available cash; equity includes cash and marked positions, entered by the user.
- BUY is a conditional next-session stop-entry, not an instruction to buy immediately. Skip opening gaps over 3%; recalculate position size for actual fills. Orders expire after one session.
- Positions are rounded down to 100-share lots, with fee/slippage allowances, liquidity participation, cash, position and aggregate risk limits. Missing stops reserve full held value as risk.
- Stops/trend exits may occur earlier than three sessions. Time exit targets the 15th held session's open when an opening date is supplied.
- All signal logic is deterministic, versioned and shared with the backtester. Symbol priority is alphabetical, not an implied performance ranking.

## Research limitations

Current sample checks are not full market-data certification. Corporate-action methodology, dividend treatment, historical price limits and historical universe membership are unverified. Backtests are explicitly exploratory and do not demonstrate profitability. The fixed four-stock universe has selection/survivorship bias. No parameter tuning was performed against holdout results.

Signals require the expected completed weekday session at/after 18:00 WIB; before then they require the preceding weekday. Exchange holidays are not yet integrated, so holiday dates conservatively block signals. Missing and stale records block trade decisions. Zero-volume or locked candles cannot be assumed executable in simulation. A stop is not a guaranteed maximum loss.

Global/yield data, news catalysts, full exchange breadth, scheduled briefs and paper-trade journaling are future phases. No fabricated data is displayed for these sections.

## Vercel preparation (not deployed)

Set ARJUM_API_KEY, DATABASE_URL and DATABASE_AUTH_TOKEN through the deployment environment. Use a persistent hosted libSQL database, not a file URL. Set APP_PASSWORD to protect the whole app with browser Basic authentication (any username). The app fails closed on Vercel without access credentials and requires a database URL. All hosted traffic must use HTTPS. No secrets are compiled into Nuxt public config.

Nuxt detects the Vercel build environment. Scheduling/deployment configuration is not included in this phase. Import/recreate research reports separately on hosted storage; local backtest files are not automatically deployed.

Zero balances: cash and equity can both be 0. The planner allocates no new buys in that state. Cash must remain no greater than total equity; negative values are rejected. Backtest scenarios still require positive starting capital to calculate meaningful returns.

