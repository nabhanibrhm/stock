# Remaining manual tests and market-open trial

Prepared 25 October 2026, Asia/Jakarta. These are manual checks to perform; unchecked items are not claims of successful testing. Automated suite currently has 35 passing tests. The app is an educational research prototype, not a validated live-trading system.

## Start the app

1. Open a terminal in D:\Dev\stock.
2. Run `npm run dev` and keep the terminal running.
3. Open http://127.0.0.1:3000/.
4. Confirm black/amber/white styling and Inter text.

## Settings and persistence

- [ ] Set cash and total equity to 300000; calculate. Expect no input error.
- [ ] Set both to 0; calculate. Expect no new BUY allocations.
- [ ] Set cash to 300000 and equity to 0. Expect the specific equity-versus-cash message. With no holdings, use the equity/cash shortcut and retry.
- [ ] Test risk 0, 0.01, 0.5 and 5 percent. Expect acceptance. Zero risk means no new purchases.
- [ ] Test risk above 5 percent. Expect rejection mentioning risk per trade.
- [ ] Save a valid configuration, reload, and verify every setting persists.
- [ ] Close and restart the local app; verify saved settings persist.
- [ ] Remember that equity includes cash plus current market value of held shares. Values are user-supplied, not inferred from entry prices.

## Holdings (temporary paper examples only)

- [ ] Add a supported symbol (BBCA, BBRI, TLKM or ANTM), number of shares, entry price, stop, target and purchase date.
- [ ] Save and reload. Verify stop, target and date survive.
- [ ] Check the HOLD/SELL explanation. SELL is a review signal, not evidence an order filled.
- [ ] Check missing stop/target warnings where applicable; unknown stop reserves the entire held value as risk.
- [ ] Remove temporary holdings and save. Restore your intended settings after tests.

## Data and planner

- [ ] Inspect the observation date and provider/source status before reading plans.
- [ ] Click refresh once; expect a complete saved snapshot or a visible error with prior cache retained.
- [ ] Refresh immediately again; expect the one-hour cooldown. Budget is four refresh attempts per WIB day, each reserving five requests.
- [ ] Compare displayed dates and at least one closing price against an independent broker/exchange source. This reconciliation is still pending.
- [ ] Verify insufficient or stale data produces blocked decisions rather than invented prices.
- [ ] WAIT is valid. More cash must not force BUY. A small balance may not support even one lot under position/risk limits.
- [ ] For a future BUY, record trigger, stop, target, expiry, lots, planned costs and reasons before the next session. Recalculate at actual hypothetical fill; skip gaps above the 3% chase limit.

## Backtest page

- [ ] Switch development/evaluation and verify periods, trades, curve and assumptions change together.
- [ ] Baseline evaluation currently reports -1.85%, 11 completed trades, 2.10% maximum drawdown.
- [ ] Confirm fee/slippage sensitivity table appears; combined stress currently returns -2.21%.
- [ ] Understand the report uses fixed Rp10,000,000 simulation capital. Changing planner cash does not rerun that report.
- [ ] Read limitations: four selected stocks, unverified corporate actions/dividends and historical membership, approximate executions, inspected evaluation period. No demonstrated profitable edge.

## Monday 26 October 2026 paper-only trial

- [ ] Before the session, start the app and confirm the official exchange/broker schedule. Standard regular-market Session I starts at 09:00 WIB on an exchange day.
- [ ] Treat this as a software observation/paper-trading trial. Do not use it as the sole basis for a real-money order.
- [ ] At market open the strategy uses completed prior-session data (expected Friday 23 October). It is not a live intraday signal feed.
- [ ] Check source dates carefully after refresh: provider may expose an unfinished Monday candle. The engine filters candles after the expected completed date; a source label may show newer data. Do not interpret this as an intraday recommendation.
- [ ] Current observed four-stock state is WAIT; reevaluate the actual loaded snapshot rather than assuming this remains true.
- [ ] Log signals, intended entries, hypothetical fills, fees and exits manually. Do not invent executions when no trigger was reached or liquidity is unavailable.
- [ ] After 18:00 WIB, refresh and verify Monday's completed data is actually present. The 18:00 cutoff is an app assumption, not a provider freshness guarantee. Missing data means wait.
- [ ] Record any error with the field values, observation date and message; never include the API key.

## Operational limits

Local app only runs while its process/computer is on. No automatic broker orders, automated paper journal or guaranteed daily schedule. Exchange holiday calendar is not integrated; weekday logic may block legitimate holiday periods. Production trading readiness remains unproven despite passing software tests.

## Optional automated checks

```powershell
npm test
npm run typecheck
npm run backtest
npm run build
```

## Reference

IDX trading hours: https://www.idx.id/en/products-services/trading-hours-and-mechanism/
IDX holiday calendar: https://www.idx.id/id/berita/jadwal-libur-bursa
Research findings: phase-4-review.md
