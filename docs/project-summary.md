# SwingLab project and conversation summary

Updated 25 October 2026 (Asia/Jakarta).

## Goal and decisions

Personal educational Indonesian stock swing research, with a 3–15 trading-session horizon and cash input in rupiah. Vue frontend via Nuxt; local use first, Vercel later. Arjum REST API is the primary data candidate; MCP is available for research but not required for application requests. Free data preference. No brokerage integration or automatic trades.

Requested daily brief: Summary, Global & Yield, Statistik IHSG, Katalis Pasar, Watchlist, Trade Plan Teknikal. The complete briefing pipeline remains a later phase; current app covers the pilot data/planner/backtest experience.

## Implemented

- Private Arjum API key in ignored .env; never exposed in public config.
- Nuxt/Vue interface, persistent local SQL market cache/settings/holdings, bounded refresh (five symbols, one-hour cooldown, 20-request daily reservation cap).
- Four pilot stocks: BBCA, BBRI, TLKM, ANTM; IHSG history.
- Deterministic breakout/pullback strategy with trend/liquidity gates, conditional next-session entries, lots, fees/slippage, stop/target, cash and risk limits.
- Manual holdings with optional stop, target and purchase date; owned-position HOLD/SELL reviews.
- Local historical backtest with next-session execution, gaps, adverse same-bar assumptions, chronological evaluation, cost sensitivity and input fingerprint.
- Project-specific ai-routing.md adapted from D:/Dev/motion/ai-routing.md; bounded agent delegation used for engine, interface, backtester and independent review.
- Black/amber/white palette from D:/Dev/portfolio/portfolio; Inter display/body and requested monospace variables.

## Latest fixes

Both cash and total equity accept zero. Equity includes cash, so equity cannot be less than cash. With no stocks, both fields should match; a shortcut helps set that value. Rp300000 in both fields was verified. Risk accepts 0–5% in increments of 0.01%; previous browser step mismatch rejected 0.5%. Generic server validation was replaced with field-specific errors. Currency inputs accept individual rupiah amounts.

## Verification and results

Latest automated suite: 35 passing tests. Typechecking passed after the latest input/message fix. Production build passed after Phase 4/font updates; the later small field/message change was typechecked but not separately production-built.

Provider validation: 500 daily observations for each pilot stock and IHSG passed basic range/date checks. Corporate-action behavior remains uncertain: BBCA split-day return differs from close-derived return. Source coverage claims are not full-history certification.

With fixed Rp10,000,000 simulation capital: development return -2.50% across 21 trades; evaluation return -1.85% across 11 trades, maximum drawdown 2.10%. Combined increased fees/slippage result -2.21%. No demonstrated profitable edge. The evaluation period has already been inspected and is not a new unseen test.

## Tomorrow and readiness

Monday 26 October 2026 can be used for local software testing and manually logged paper observation. Do not treat the app as validated real-money trading advice. It is an end-of-day strategy, not a live intraday feed. Before 18:00 WIB, expected completed history is the previous weekday; at Monday open that is Friday 23 October. Provider freshness and holidays require checking. The current observed sample produces WAIT for all four stocks; future results must be checked from actual data.

The computer and app process must remain running. No automatic daily scheduler or paper journal has been implemented. Standard regular-market session begins 09:00 WIB on exchange days; confirm the actual day through IDX/broker announcements.

## Remaining work

Finish manual checks; independent prices/calendar reconciliation; corporate-action/dividend methodology; historical point-in-time universe and execution constraints; forward paper evaluation; global/yield/news sources; complete daily briefing; hosted database/access/deployment verification. GitHub publication is not deployment or proof of trading readiness.

## Files to use next

- manual-test-checklist.md: remaining manual tests and market-open trial.
- github-setup.md: safe GitHub initialization/upload steps.
- phase-4-review.md: detailed research verdict and sensitivity results.
- ../README.md: local operation and architecture.
- ../ai-routing.md: implementation/delegation rules.

No GitHub repository has been created or pushed. No Vercel deployment has been performed.

