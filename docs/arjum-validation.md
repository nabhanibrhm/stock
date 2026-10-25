# Arjum connection validation

Checked 2026-10-25 (WIB). Credentials read privately from .env; no credential copied into this report.

- Authenticated GET /api/search?q=BBCA: HTTP 200, BBCA returned, last_date 2026-10-23.
- GET /api/history/BBCA?limit=30: HTTP 200, default frame daily. Response includes dated OHLCV, turnover, frequency and foreign-flow fields.
- Provider metadata advertises BBCA coverage from 2020-01-02 through 2026-10-23. Full range has not been downloaded or validated.
- Successful history response headers: x-quota-cost=1, x-ratelimit-limit=1000, x-ratelimit-remaining=997. These are the observed account values, not a permanent service guarantee.
- Two earlier requests with limit=5 returned HTTP 422; one also specified frame=daily. Validation bodies were not captured. Do not infer a documented minimum from these responses; use the successful limit=30 request until parameter constraints are verified.
- A first restricted-network request failed before receiving an HTTP response; the permitted network retry succeeded.

Still unverified: corporate-action adjustments, historical completeness, units of foreign-flow fields, other-symbol/index coverage, reuse rights and full quota-reset behavior. Connection success does not establish investment-data accuracy or strategy performance.

## Bounded data validation completed

Validation scope: four equities (BBCA, BBRI, TLKM, ANTM), IHSG, a BBCA split-period sample, stock lookup and the current screener. Ten requests made in this validation run; nine HTTP 200 and one intentional HTTP 422 to confirm parameter constraints. Final observed remaining quota: 986. Header movements between requests were not strictly attributable to this run, so do not infer total account usage from subtraction.

### Results

| Dataset | Rows | Dates | Result |
|---|---:|---|---|
| BBCA | 500 | 2024-09-18 to 2026-10-23 | Basic checks pass |
| BBRI | 500 | Same | Basic checks pass |
| TLKM | 500 | Same | Basic checks pass |
| ANTM | 500 | Same | Basic checks pass |
| IHSG | 500 | Same | Basic checks pass |
| BBCA split window | 13 | 2021-10-01 to 2021-10-19 | One return discrepancy |

For the five recent series (2,500 rows), no missing required OHLCV fields, duplicate dates, invalid price ranges, negative volumes, weekend dates or close-to-close return discrepancies beyond 0.025 percentage points were found. All four stock date sets match the sampled IHSG date set. Foreign buy minus sell equals reported net where those fields exist; this does not establish units. No absolute daily close-to-close move exceeded 20% in these recent samples. Date alignment with the same provider is not an independent exchange-calendar completeness test.

IHSG is a supported symbol; search for JKSE returned no match. Latest observation across these series is Friday 2026-10-23. This is consistent with the Sunday 2026-10-25 validation date but does not verify future publication latency.

History limit has a minimum of 20 (confirmed by the API validation response). Successful limit=500 requests return newest-first rows; sort ascending for indicators. Metadata claims availability from 2020-01-02, but the entire range has not been audited.

### Corporate-action finding

BCA confirms a 1-for-5 split effective for trading on 2021-10-13:
https://www.bca.co.id/en/tentang-bca/media-riset/pressroom/siaran-pers/2021/10/13/08/12/saham-bbca-resmi-diperdagangkan-dengan-harga-baru

The API reports pre-split 2021-10-12 close 7,320 and post-split 2021-10-13 close 7,525. This is consistent with adjusted pre-split pricing rather than an unadjusted fivefold discontinuity, but is not proof of the provider's adjustment methodology. Calculated return on October 13 is 2.80055%, while change_pct says 2.73%. Treat this as an unresolved corporate-action consistency issue. Recompute returns from the selected price series; do not mix provider returns with calculated returns. Validate volume, dividends, rights issues and split factors before reliable long-range backtesting or historical execution sizing.

### Screener

The latest screener is dated 2026-10-23 and contains 12 selected candidates, not the entire exchange universe. Its date field is formatted prose rather than ISO date. Two candidates have null win-rate/potential/drawdown values. These are provider analytics, not calibrated probabilities or our strategy output. A preliminary generic rows check wrongly treated screener rows as candles; that check is not applicable and is excluded from quality results. Separate schemas are required.

### Usage and remaining coverage

Reviewed https://stock.arjum.com/terms. It describes shared REST/MCP quota, midnight WIB resets and prohibits excessive disruptive scraping. It does not explicitly establish redistribution or long-term archival rights; do not assume public republication rights.

Not established in this run: exchange-wide historical membership including delisted shares; authoritative calendar comparison; independent recent-price reconciliation; full corporate-action policy; market-wide breadth/sector turnover; global markets, yields, news/calendar feeds; broker/fundamental endpoint quality. No tests claim to cover these.

### Decision

Conditional pass for building a private daily-data prototype, technical indicator pipeline and IHSG chart. Not yet cleared for trustworthy full-history performance claims or actionable production signals. Use deterministic recomputed returns, explicit timestamps, missing-data gates and provider labels. Corporate-action policy and point-in-time coverage are the main backtesting blockers. Other brief sections require separately validated sources.

Evidence: arjum-quality-results.json, arjum-samples.json, arjum-extra-samples.json. Local checker: scripts/check-arjum-samples.ps1. Saved samples contain market data only; API key remains in ignored .env.
