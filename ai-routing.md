# AI routing - Indonesian swing research app

Adapted with user approval on 2026-10-25 from D:/Dev/motion/ai-routing.md.
This project uses Vue and server-side market analytics, not Remotion.

## Workflow
- Read this file before changes; identify target files and choose effort by highest-risk file.
- Use the least costly available, user-approved model suitable for the task. Do not invent availability or claim to switch a session model. If switching is unavailable, retain the current model and disclose that limitation when relevant.
- Do not spawn agents unless explicitly requested by the user or applicable instructions.
- Routine documentation/copy/style: low effort. Individual UI or provider adapter: medium. Shared schemas, API boundaries, authentication, caching: high. Financial calculations, backtesting, dependencies, deployment architecture: high with focused verification.
- Scope expansion requires reassessing effort, not repeated approval for already authorized work.

## Proposed path map
- docs/**, README.md: low; financial specifications: high.
- app/pages/**, app/components/**: medium; shared state and layouts: high.
- server/api/**, server/services/**, shared/**: high.
- analytics/**, tests/financial/**: high; review execution assumptions and numerical edge cases.
- package.json, lockfiles, nuxt.config.*, deployment and database configuration: high.

## Non-negotiable project rules
- Keep provider keys server-side; never in public runtime config, browser storage, logs, or committed files.
- Separate synthetic examples, provider recommendations, and our calculated signals.
- Signals need source timestamps, strategy version, prerequisites, expiry and explicit reasons.
- Missing/stale/incomplete market data must block actionable signals.
- Use deterministic financial calculations. No language-model-generated prices, quantities or probabilities.
- Round positions down to valid lots; account for fees, slippage, tick rules and portfolio constraints.
- Backtests must prevent look-ahead and survivorship bias and include adverse execution cases.
- Persist application data outside serverless local files. Long backtests run separately from web requests.
- Verify changed behavior with appropriate type checks, builds and meaningful tests. Never claim tests ran when they did not.
- No automatic brokerage execution in the initial scope.
