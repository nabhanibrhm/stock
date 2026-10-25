# Local backtest workflow

Run `npm run backtest` from the project root. It reads the bounded, validated Arjum sample files in `docs/` and writes `data/backtest-report.json`. It makes no API requests and never reads the API key. Run `npm test` for the financial regression tests.

The four-symbol sample is split chronologically: the first 60 sessions provide warmup, the development window ends at 70% of the sample, and the final 30% forms a holdout. Rules are fixed before either run; no parameters are searched. Each window starts independently with Rp10,000,000. Warmup prices are available to indicators, but positions do not carry across the split.

Signals reuse `buildPlans` from the live planner. An order may fill only on the following index session. Untriggered orders expire after that session. A gap more than 3% above the trigger is skipped. Execution prices include slippage; quantities are rounded to lots and reduced when actual entry risk or available cash requires it. These slippage prices represent average execution costs, not literal exchange-limit order quotes.

Daily bars cannot resolve intraday order. When both stop and target are touched, stop wins. On an entry bar, the low is conservatively treated as occurring after entry. Existing gapped stops fill at the opening price. Locked or absent candles never create fills. Entry sizing uses prior-session marked equity, and cash released by same-day exits is unavailable for new entries until the next session.

Stops and strategy exits may occur before three sessions. The standard time exit is the 15th held-session open. Open positions at the end remain explicitly listed and marked to estimated liquidation value; they are not invented closed trades. Closed-trade expectancy and win rate therefore differ from portfolio net return when positions remain open.

The benchmark is theoretical fractional IHSG exposure with identical initial cash and cost assumptions; IHSG itself is not a directly tradable asset. Final equity includes estimated liquidation costs on both strategy and benchmark holdings.

This is an exploratory tool, not performance validation: the universe is a current selection of four stocks, survivorship is unresolved, corporate-action and dividend methodology are unverified, and exchange-specific historical price limits are not modeled. Locked candles and gap handling approximate execution constraints but do not prove fill availability. An independent price/calendar check, historical membership, corporate-action data, and unseen forward paper trading are required before stronger claims.

## Phase 4 review

Opening gaps through an existing target now execute at the opening price less slippage before intraday low/high checks. Exposure is the percentage of sessions with any position held during the session, including positions exited at the open and same-session round trips. Holding targets are shared with the planner.

The report includes a SHA-256 fingerprint of normalized input data, fixed settings and holdout fee/slippage scenarios. These scenarios diagnose cost sensitivity; no parameters are selected from their results. The historical evaluation period has already been inspected and must not be described as newly unseen. A fresh forward period is still required.
