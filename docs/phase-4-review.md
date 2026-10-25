# Phase 4 review — 25 October 2026

Verdict: exploratory validation run completed; no demonstrated profitable edge. Not cleared for production trading signals.

Scope: BBCA, BBRI, TLKM, ANTM, with IHSG as a theoretical comparison. Each window starts with Rp10,000,000. Planner balances in the UI are independent of this fixed research capital. No strategy tuning was performed against these results.

Development: 12 December 2024–6 March 2026. Evaluation: 9 March–23 October 2026. The evaluation period has already been inspected; repeating it does not create a fresh unseen test.

Independent review found and corrected opening-gap target priority, undercounted intraday exposure, and missing original targets on manual holdings. New regression tests cover each behavior. The full suite now has 34 passing tests.

The generated report at data/backtest-report.json contains exact metrics, cost-sensitivity scenarios, input-data fingerprint, settings, equity curves, individual trades and assumptions. These results use validated local snapshots and consume no API quota.

Remaining limits: fixed four-stock selection/survivorship bias; unverified corporate-action/dividend policy; no complete historical exchange price-limit or fill-availability model; stale marks can understate drawdowns; daily bars cannot resolve intraday sequencing. Independent historical reconciliation, point-in-time universe data and forward paper trading are still required. Do not describe this phase as proving profitable predictions.

The app's Backtest page now displays cost-sensitivity results. Manual holdings can retain original targets. Inter is used for display/body through the requested CSS variables; code uses the requested monospace stack.

| Scenario | Net return | Maximum drawdown | Closed trades |
|---|---:|---:|---:|
| Development baseline | -2.50% | 3.40% | 21 |
| Evaluation baseline | -1.85% | 2.10% | 11 |
| Evaluation, doubled fees | -1.98% | 2.20% | 11 |
| Evaluation, 0.30% slippage | -1.98% | 2.20% | 11 |
| Evaluation, both cost stresses | -2.21% | 2.41% | 11 |

Evaluation closed-trade win rate: 9.09%; average net profit/loss per completed trade: -Rp16,780.02. Small sample and dependent trades prevent interpreting win rate as a reliable future probability.
