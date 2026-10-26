# Expanded stock universe — 26 October 2026

## Current implementation

The four-stock-only live scanner has been replaced with catalogue discovery. Arjum /api/market-cap is paginated at 50 rows, bounded to 25 pages. Only four-letter equity-style codes are admitted; IHSG is excluded from stock candidates and loaded separately. Catalogue date/page consistency is checked. This source is a discovery universe, not point-in-time historical exchange membership.

Preselection prioritizes held positions, then the highest latest-session market_cap × turnover_ratio proxy, with market cap and symbol as tie-breakers. Up to 60 histories are fetched (120 observations each), with four concurrent reads at most. This proxy selects a manageable scan subset; it is NOT the final liquidity filter and does not imply the highest-ranked opportunities across the entire exchange. Stocks outside the cap are not evaluated for setups.

Data admission requires valid, fresh candles; at least 60 sessions aligned with IHSG; positive latest volume; and a 20-session average trading value at least equal to the user's minimum (default Rp1 billion). If actual trading value is unavailable, close × volume is used and disclosed. Failed histories are reported and blocked, not silently replaced with old candles. Catalogue/IHSG or total history failure preserves the prior saved cache.

Qualifying setups must separately pass the existing IHSG/trend/breakout-or-pullback rules. Eligibility is not a BUY signal. The planner keeps ineligible and blocked stocks visible with reasons.

## Ranking and capital

Strategy version: swing-eod-1.1.0. Only qualifying, unheld setups receive rank and score before sizing:

score = 2 × clipped(relative 20-session return versus IHSG, -20 to 20)
      + 10 × (clipped(latest volume / prior 20-session average volume, 0 to 5) - 1)
      + clipped(close distance above SMA50 in percent, -20 to 20)

Higher score receives capital first; equal scores use symbol order. Existing holdings remain visible for review. A ranked setup can still become WAIT when cash/risk/position limits prevent allocation. Scores are ordering heuristics, not probabilities, calibrated forecasts or proven profitable rankings.

## Budget and caching

400 locally reserved requests per WIB day, one-hour cooldown. Each run reserves at most 86 requests. A one-time migration from legacy scan mode can run immediately, preserving already-used daily budget. Actual provider remaining quota is also checked; low quota stops additional requests conservatively. Four concurrent history reads may already be in flight when low quota is detected. No API key reaches the UI.

## First real scan

Observation date: 26 October 2026. Provider reported 963 catalogue records; 962 admissible stock codes remained after filtering. All catalogue pages were read. Selected/scanned: 60/60. Failed histories: 0. Eligible under saved thresholds: 60. Qualifying entries: 0, because IHSG was below SMA50. No BUY was fabricated to fill the larger watchlist.

A temporary Rp1 trillion liquidity threshold reduced eligibility to one stock, demonstrating the filter updates from settings. Saved settings were not changed. Immediate repeat refresh was rejected by the cooldown.

## Verification and limitations

45 tests pass, including preselection, pagination bounds, stale catalogue rejection, quota migration/caps, history/liquidity admission, deterministic ranking, scarce-capital ordering and future-data isolation. Typechecking passes. Production build and browser checks are reported in the task response.

The older report remains version1.0.0 on four selected stocks; it does not validate this wider universe or new ordering. A larger point-in-time historical universe and independent corporate-action methodology are still required for valid expanded backtesting. The UI explicitly marks that distinction.
