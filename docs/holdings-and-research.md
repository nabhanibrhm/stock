# Holdings monitoring and Arjum research

Implemented 2026-10-26. Delegated under ai-routing.md to journal/backend, provider/research, and interface agents, with integration and verification by the parent.

## Using the features

1. Open Portofolio. If starting with existing positions, enter the opening snapshot and available cash before recording the first transaction. Save these values first.
2. Record only a transaction that actually occurred: BUY/SELL, date, shares, actual price, and total fee in rupiah. This is bookkeeping, not a brokerage order. Partial sales update remaining shares. Duplicate submission IDs cannot book a fill twice.
3. Cash and holdings update together. Estimated equity is cash plus remaining holdings at cached closing prices, or entry prices if no close exists. Review equity before using sizing; cached valuation is not realtime.
4. Use Perbarui data for a new completed market session, then Periksa posisi. Monitoring uses the shared deterministic exit rules. Fresh complete data is required; otherwise the card says WAIT. Alerts are stored in-app, deduplicated and can be acknowledged. Historical alerts are separate from current guidance.
5. Open Riset saham or click a symbol in Trade planner. Selecting a symbol reads the cache without spending provider quota. Ambil data Arjum requests its broker/financial context. BBCA has a verified cached example from the implementation check.

After journaling begins, manual cash and position-quantity edits are blocked to protect the ledger. Risk settings, total equity, stops and targets remain editable. A deposit/withdrawal and transaction-correction workflow is not implemented yet; double-check actual fills before recording. Imported positions have unknown fee-inclusive basis, so realized profit on them is unavailable rather than invented. Journal displays up to the latest 500 transactions; older records remain persisted.

## Monitoring limits

- End-of-day snapshots, refreshed manually. No background scheduler, intraday guarantees, external notifications or brokerage execution.
- Stop/target touches are review conditions, not confirmed fills. A gap can exceed planned loss. OHLC on the purchase date may include touches before the purchase.
- Estimated sale proceeds use cached close minus configured slippage and sale fees. Actual fills and fees are entered separately.
- Exchange holiday calendar and corporate-action handling remain existing validation gaps.

## Research scope

- Two dated foreign/domestic broker summaries, historical broker accumulation, three financial reports (income, balance sheet, cash flow), and the provider's textual analysis report.
- At most seven provider requests per symbol refresh; one-hour cache/cooldown, sharing the existing 400-request daily budget. Research does not reset the scanner cooldown. Failed individual sources remain explicit; total failure retains the previous cache.
- Broker lists are limited rows. Their values are not total market or total foreign flow. Historical accumulation sums available daily net values and discloses coverage.
- Financial flags currently show positive/negative/zero profit, equity and operating cash flow where recognized. Bank-style deposit accounts trigger a bank-specific explanation. Other sector classification remains unverified.
- Currency/scale, publication dates and quarter-versus-cumulative basis are not confirmed. No unsupported nominal financial figures, debt ratios or growth rates are calculated. Periods older than 200 days are marked stale; this threshold is a display heuristic.
- Research is current descriptive context. It does not change ranking, sizing or BUY/SELL decisions, and is not used in historical tests without point-in-time publication data.

## Verification

- 57 automated tests passed, including actual fees and partial sales, duplicate submissions with concurrent persistent writes, stale exit blocking, deduplication, quota sharing, invalid research schemas and bank-aware financial flags.
- Type checking and production build passed.
- Local journal/research endpoints verified without recording user trades. Six authenticated BBCA provider responses validated; cache showed 16 broker/accumulation items and four financial context items.
- Browser checked empty holdings/journal and populated BBCA research, including missing-data disclosures.
- The old four-stock backtest remains exploratory. These features do not establish profitability; expanded-universe and research-enhanced strategies still need evaluation.

Local AI explanations (Qwen/Gemma via Ollama) remain future work in future-priorities.md. No AI credits are consumed by these features.

## Analisa AI from Arjum

Riset saham now includes a separate provider report from GET /api/analysis/{code}. The authenticated ANTM sample explicitly labels its report as AI-generated; the API documentation describes automated analysis and does not establish a particular AI model or methodology. The UI attributes the AI label to Arjum.

The provider text is displayed as escaped plain text, never executed HTML. Its recommendations, suggested levels and performance claims do not alter SwingLab calculations or become validated probabilities. Observation date comes from the report where recognizable; missing dates remain unverified and older reports are marked stale. Collection time is shown separately.

Use Ambil data Arjum to fetch the complete research bundle. Each refresh reserves seven Arjum requests. No separate paid AI API key is used. Old research caches without an analysis report remain usable and show the analysis unavailable until the next permitted refresh. Availability is per stock; the app does not fabricate an analysis when the provider omits it.

Analysis addition verification: 59 tests passed, type checking passed, and the authenticated ANTM report was checked in the browser. The one-call ANTM validation cache contains analysis only; its broker/financial sections remain unavailable until a normal complete refresh.
