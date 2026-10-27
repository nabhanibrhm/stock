# Manual AI review and configurable holding periods

Built for Indonesian stocks and a 3–15 trading-session holding horizon. No AI API key is required: the application prepares text for you to copy into a chat service of your choice. It never sends the prompt or places a brokerage order.

## Example: Rp300,000 and 10 sessions

1. Save available cash and total equity as Rp300,000 if you have no other positions. Set the holding period to 10 sessions and choose your risk limits. Saving matters: generated prompts use saved settings and positions, not unsaved form edits.
2. Refresh completed market data when needed. Review the ranked candidates. WAIT is valid when no setup qualifies or the budget/risk limit cannot fund one lot including costs.
3. Open Prompt manual and choose Deep Research. Select candidates, choose whether to include cached Arjum context, and generate the preview. Review the source dates and missing-data warnings.
4. Portfolio information is excluded by default. Opt in if you want cash, equity, holdings and personally sized plans included. Read the preview before copying; pasting into an external AI chat shares the included information with that service.
5. Copy the prompt and paste it into your chosen AI chat. Ask for comparisons and explanations. Return to Starting Plan to review the app's numerical plans before deciding whether to place a manual order with your broker.
6. If an order fills, record its actual date, quantity, price, fee and holding period in Portofolio. The purchase session is day 1. The planned time exit is the opening of session 10. Stops, targets and other exit conditions can require an earlier review.
7. Refresh completed data and use Daily Check-in to review existing positions. The prompt does not execute AI responses or import them as new orders. The current engine remains authoritative for calculations.
8. Record any actual partial or full sale. Remaining shares retain the original entry date and holding-period plan. Adding shares does not restart the holding clock.

## Three templates

| Template | Purpose |
| --- | --- |
| Deep Research | Compare selected candidates, contradictory evidence, data gaps and cached provider research. |
| Starting Plan | Explain whether the saved calculated plans fit the selected horizon and, when included, portfolio constraints. |
| Daily Check-in | Review owned stocks, existing risk levels and planned exit dates. With no positions, report that there are none to monitor. |

These are original templates for this application's data and constraints, inspired by the workflow discussed in LLM Trading Lab. They do not copy its US-market capital, IPO rules, or order-execution model. Arjum analysis is attributed provider text, treated as reference material rather than instructions.

## Dates, freshness and limits

- The supported exchange-calendar coverage and source are exposed in the application and documented with the calendar implementation. Weekends and listed exchange holidays do not count as sessions.
- Calendar coverage is bounded: an unavailable year or deadline is labeled unsupported, not guessed. Exchange announcements can amend holiday schedules.
- The application remains an end-of-day system with an 18:00 WIB cutoff; it is not an intraday order monitor. An exit date means a planned action, never a guaranteed fill.
- Existing positions without a saved holding period keep their legacy 15-session horizon. Changing the setting applies to new positions; it does not silently shorten existing trades.
- Prompt generation reads cached research only. Refreshing market/research data remains a separate action subject to Arjum quota.
- Missing or stale inputs must remain visible. AI must not invent prices, quantities, dates or profit probabilities, or bypass an app WAIT condition.
- Preview output is bounded. Candidate selection and research excerpts may be limited, with disclosures. An explanation is not proof of profitability.
- Chat providers may have their own account limits and privacy terms. No paid AI service, model installation, automated response processing, or notification delivery is added.

## Validation checklist

- Verify a 10-session schedule across weekends and an exchange holiday; test unsupported calendar coverage.
- Check early stop/target exits and time exits, plus legacy 15-session positions.
- Verify adding shares and partial sales preserve the original schedule.
- Generate each template without an AI key or provider requests; confirm only saved values appear.
- With portfolio sharing off, inspect the full text for absence of personal balances, quantities and cost basis. With it on, verify amounts match saved values.
- Change a mode, stock selection or privacy option: discard the old preview and regenerate before copying.
- Confirm empty holdings, insufficient funds and stale/missing research are explained rather than filled with invented data.
- If clipboard access is unavailable, select the preview and copy manually.
- Use a separate database for synthetic fill tests; do not insert fictitious trades into the real journal.

## Verification on 2026-10-27

- Full suite: 79 tests passed, including calendar/horizon, fill accounting, prompt privacy and cached-only generation.
- Type checking and production build passed. The build emits an existing Nuxt module-preload sourcemap warning.
- Isolated browser check: generated an ANTM Deep Research preview with private sharing off; stale cached data showed WAIT and missing-research warnings. Switching to Starting Plan removed the previous preview. Desktop layout inspected.
- No live provider refresh, external AI submission or real portfolio mutation was performed. Clipboard fallback and mobile layout remain items for manual acceptance testing.
- Delegation used GPT-6.1 Sol high for financial/calendar changes, GPT-6 Sol high for prompts and independent review, and GPT-6.1 Terra medium for UI. No Astra worker was needed.
