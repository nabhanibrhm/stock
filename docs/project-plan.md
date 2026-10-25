# Project plan

Updated: 2026-10-25 (Asia/Jakarta)
Status: phases 2-3 implemented as a four-stock local prototype; phase 4 tooling and exploratory evaluation implemented, with validation limitations still open.

## Confirmed
Indonesian stocks; 3-15 day swing horizon; free data preference; Arjum primary candidate; Vue frontend; local development followed by user-managed Vercel deployment; adaptation of AI routing approved.

## Proposed defaults
Long-only, paper trading first. Interpret horizon as trading sessions (configurable). Bahasa Indonesia brief. One evening end-of-day brief for the next session; manual refresh reuses cached data. No paid AI dependency: use structured, deterministic brief templates initially. Risk settings configurable; illustrative defaults require clear labels, not claims of optimality.

## Architecture
Nuxt (Vue + TypeScript) frontend and server API routes in one deployable application. Arjum REST adapter on server; MCP optional for research. Deterministic signal engine shared with local backtest runner to prevent strategy drift. Persistent SQL store through a storage interface; local development database and externally hosted database for Vercel. Select a free database provider after checking current limits. Heavy historical ingestion/backtests run locally, not inside interactive serverless requests. Private deployment must authenticate access to holdings and refresh endpoints.

## Data findings
Public documentation inspected in browser on 2026-10-25:
- https://stock.arjum.com/api-docs#mcp documents Streamable HTTP at https://stock.arjum.com/mcp with X-API-Key, read-only tools, and quota shared with REST.
- https://stock.arjum.com/ advertises free daily quota resetting at 00:00 WIB. Exact allowance is not stated publicly in the inspected page; verify in account dashboard.
- REST includes screener, analysis, OHLCV history, broker summaries/accumulation, market cap, search, financial statements, insiders, order flow, batch prices and movers.
- Batch prices charge per symbol; batch calls and field filtering do not reduce quota cost.
- Global indices, bond yields, news, economic calendar and full IHSG statistics are not established by the documented endpoint list. Verify coverage and add independent sources where needed.
- Live calls, data quality, historical depth, corporate-action adjustment, licensing/storage rights and response freshness remain unverified. API key subsequently configured privately and connectivity verified; see arjum-validation.md.

## Phases and acceptance gates
1. Data feasibility: authenticated small samples; actual quota; historical depth; timestamp conventions; adjusted/raw prices; IHSG support; permitted caching. Deliver provider coverage matrix and quota budget. No strategy reliability claims yet.
2. Application foundation: Nuxt shell, private configuration, schemas, storage, provider adapter, cache, request budget, error handling and source status. Gate: key never reaches browser; stale data visible; refresh cannot consume unbounded quota.
3. Signals and capital: explicit breakout/pullback baseline; liquidity and regime filters; BUY/WAIT/HOLD/SELL; lot sizing, tick rounding, fee/slippage assumptions, stops/targets, aggregate exposure and cash reservation. SELL requires holdings. Gate: deterministic tests for insufficient funds, gaps, invalid stops, missing data and competing trades.
4. Backtesting: next-session execution, point-in-time universe/data, splits/dividends, fees, slippage, suspensions and price limits. Treat same-bar stop/target ambiguity conservatively. Compare with appropriate benchmarks using identical capital assumptions. Gate: untouched evaluation period and report on net expectancy, drawdown, turnover and uncertainty. If history is insufficient, label validation unavailable and collect forward paper results.
5. Brief and dashboard: Summary; Global & Yield; Statistik IHSG; Katalis Pasar; Watchlist; Trade Plan Teknikal. Every item has source and observation time. Missing coverage displays unavailable, never fabricated or filled with unlabeled demo data.
6. Paper pilot: holdings and journal; planned versus simulated fills; track expired triggers and no-trade days. Gate: explain differences from backtests and review operational failures.
7. Vercel preparation: durable database, authentication, bounded scheduled imports, backups and logs without secrets. Gate: local build and deployment preview checked; no deployment performed without user request.

## Required briefing fields
Summary: market stance and main drivers/risks.
Global & Yield: selected indices, US/Indonesia yields, USD/IDR and relevant commodities, each with its own observation date.
Statistik IHSG: close/change, turnover, breadth, sectors and foreign flow where supported.
Katalis Pasar: sourced dated events, disclosures and upcoming catalysts; facts separate from inference.
Watchlist: setup, liquidity, ranking reasons, trigger and invalidation.
Trade Plan Teknikal: action, entry trigger, stop, targets, expiry, horizon, lots, costs, planned loss and portfolio impact.

## Financial constraints
Available cash and portfolio equity are distinct. Size uses the minimum of affordability, risk budget, position cap and liquidity cap, rounded down to whole lots. Deduct fees and reserve cash across simultaneous candidates. Planned stop loss is not a maximum guaranteed loss. Provider scores and seasonality win rates are not calibrated probabilities for our strategy. Do not require daily trading.

## Scheduling and cost
One scheduled daily refresh is the initial target, gated on confirmed completed market data. Use trading calendar checks. Vercel schedule frequency and execution limits must match the selected plan; local scheduling only runs while the machine is available. Cache is durable and quota-aware. Keep provider keys and scheduler secrets private. Free data does not imply unlimited API or free hosted language-model inference.

## Remaining inputs and verification
API key configured privately. Observed quota limit: 1,000. Initial universe: BBCA, BBRI, TLKM, ANTM. Corporate-action policy, exchange holiday calendar, and point-in-time universe remain validation gaps. See README.md and implementation.md for current behavior.

## References
https://stock.arjum.com/
https://stock.arjum.com/api-docs#mcp
https://vercel.com/docs/frameworks/full-stack/nuxt
https://vercel.com/docs/cron-jobs/usage-and-pricing

