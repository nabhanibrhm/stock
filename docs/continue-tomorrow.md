# Continue tomorrow — SwingLab

Handoff written: 26 October 2026, Asia/Jakarta. Intended next session: 27 October 2026.

## Message to paste

Continue the SwingLab project in D:\Dev\stock. First read ai-routing.md, docs/continue-tomorrow.md, docs/holdings-and-research.md and docs/universe-expansion.md. Follow the AI routing rules and delegate independent implementation tasks when useful.

Start by checking Git status and whether localhost is running; use npm run dev if needed. Review the latest saved data and its observation dates before making any market claims. Help me test the current beginner workflow: available cash and equity, stock scanning, trade plans, actual-fill journal, holdings exit monitoring, and Riset saham including Analisa AI from Arjum. Preserve my real portfolio and API key; use a separate test database for simulated transactions.

Explain the current BUY/SELL/WAIT results in simple language and distinguish our calculated signals from Arjum's recommendations. This is an end-of-day strategy: during market hours, the prior completed session may be the expected data. Do not claim the current day's closing signal is available before the data cutoff. Respect provider quota and cooldowns.

Fix any reproducible issues found during testing. Then summarize the remaining gaps and recommend the next development step, especially expanded-universe backtesting and forward paper-trading evaluation. Keep local AI models, external notifications, LLM Trading Lab integration, and deployment as future work unless I explicitly request them. Do not place brokerage trades or claim guaranteed profit.

## Current implementation

- Vue/Nuxt + TypeScript, local libSQL/SQLite persistence. Intended future deployment: Vercel with durable hosted database.
- Indonesian stocks, 3–15 trading-session horizon. Black/amber palette and Inter fonts.
- Universe discovery found 962 stock codes on the last verified scan; history scan capped at 60 candidates, prioritizing held stocks and trading activity.
- Eligibility requires fresh, valid history, at least 60 sessions aligned with IHSG, and the configured 20-session liquidity threshold. Qualifying setups are ranked before allocating capital.
- Last verified scan on 26 October: 60 histories checked, no fetch failures, all WAIT because the IHSG trend filter blocked entries. Recheck this; it is a historical observation, not tomorrow's recommendation.
- Cash/equity may be zero; existing validation and sizing account for fees, slippage, lots and risk limits.
- Portofolio: actual fills with fees, partial sales, duplicate protection, current monitoring and persistent in-app exit alerts. Manual cash/quantity edits are blocked once journaling starts; stops, targets, equity and risk settings remain editable.
- Riset saham: broker foreign/domestic rows, historical accumulation, limited financial flags, and provider-labeled Analisa AI. These do not change our strategy's ranking or position sizing.
- Arjum research refresh: up to seven requests per stock, one-hour cache/cooldown, shared 400-request daily application budget. Selecting a stock reads cache only.
- ANTM's analysis was verified and cached separately; its other research sections need a normal full refresh. Other saved data may have changed since this note.
- No separate AI service or paid model API is connected. Arjum analysis consumes Arjum quota.

## Validation and repository state

- Latest completed checks: 59 automated tests passed, type checking passed, production build passed. Browser verified journal/research screens and ANTM provider analysis.
- Last observed commit: 74323e9 — Add broader stock screening, trade journal, and Arjum research.
- Working tree was clean before this handoff file was added. This note has not been committed by the assistant. Inspect current Git status rather than assuming it remains unchanged.
- The dev server was started at http://127.0.0.1:3000/ during implementation; check whether it is still running.
- Secrets are in ignored .env; local portfolio/cache files are under ignored data/. Never print credentials or commit either.

## Known gaps and next priorities

1. The old four-stock backtest was negative and exploratory; it does not validate the expanded scanner. Evaluate the current strategy with point-in-time data and realistic execution, then collect forward paper results.
2. Exchange holidays, corporate-action adjustments, dividend treatment and historical universe membership remain unresolved. Current freshness logic uses weekdays and an 18:00 WIB cutoff.
3. Alerts are in-app and checked on page access/refresh; no scheduled or intraday monitoring, email, phone notification or brokerage execution.
4. Financial units, publication dates and quarterly/cumulative basis are not confirmed. Flags show signs only; bank-specific caveats apply. Broker lists are partial, not total foreign flow.
5. Arjum's AI label and historical claims are provider statements. Its AI model/methodology is unverified. Stale or missing dates must stay visible; no provider recommendations become automatic orders.
6. Journal deposits/withdrawals and transaction corrections are not implemented. Check entries before recording. Imported positions have unknown fee-inclusive cost basis.
7. Global & Yield, sourced news catalysts, full exchange breadth, scheduled briefs and Vercel deployment remain future work.
8. Optional Qwen/Gemma via Ollama and LLM Trading Lab-inspired journaling/evaluation ideas are documented in future-priorities.md. No model installation or upstream code integration has been performed.

## References and commands

- [Usage and limits](holdings-and-research.md)
- [Universe and ranking](universe-expansion.md)
- [Manual tests](manual-test-checklist.md)
- [Future work](future-priorities.md)
- [GitHub setup](github-setup.md)

Run from D:\Dev\stock:

```powershell
git status --short
npm run dev
```

Use another terminal for checks when changes warrant them:

```powershell
npm test
npm run typecheck
npm run build
```
