# AI routing - SwingLab Indonesian stock research

Updated 2026-10-27 after reviewing the current source tree and interrupted changes.
Originally adapted from D:/Dev/motion/ai-routing.md with user approval.

## Scope and current status

- Read this file before delegating or changing the project. Inspect git status and relevant code before assigning ownership.
- This policy selects coding subagents. It does not configure an AI model inside SwingLab, purchase API credits, or change the parent chat model.
- The user approves the eight models below and effort appropriate to the task. Delegate within the authorized task when useful; a stop instruction overrides this policy.
- The user resumed the six-phase manual AI workflow on 2026-10-27 with this routing policy. A later stop instruction overrides that authorization.
- Preserve existing calendar, prompts, UI, engine, journal and backtest changes and verify their integration. Earlier passing checks do not validate later changes.
- Choose by the highest-risk behavior affected, not merely file size or extension.

## Approved models

These are project routing choices, not claims about relative prices or benchmark performance.

| User-approved model | Tool model ID | Preferred assignment | Normal effort |
| --- | --- | --- | --- |
| GPT-6.1 Sol | `gpt-6.1-sol` | Substantial implementation, integration, shared contracts | medium; high for correctness-sensitive work |
| GPT-6 Astra | `gpt-6-astra` | Difficult unresolved defects, ambiguous financial methodology or architecture, focused critical review | high; xhigh only with a concrete reason |
| GPT-6.1 Terra | `gpt-6.1-terra` | Bounded Vue UI work, straightforward adapters and refactors | medium; high for sensitive boundaries |
| GPT-6 Sol | `gpt-6-sol` | Alternate implementation and independent review | medium or high |
| GPT-6 Luna | `gpt-6-luna` | Inventory, documentation, copy, styling, simple triage | low; medium for bounded code |
| GPT-5.6 Sol | `gpt-5.6-sol` | Alternate implementation or review when supported | medium or high |
| GPT-5.6 Terra | `gpt-5.6-terra` | Alternate bounded implementation when supported | medium |
| GPT-5.6 Luna | `gpt-5.6-luna` | Alternate documentation, inventory and small fixes when supported | low or medium |

### Availability is separate from approval

- Recheck the live delegation tool schema each session.
- At this review, `collaboration.spawn_agent` advertises the first six models above. GPT-5.6 Terra and GPT-5.6 Luna are approved but are not advertised by that subagent tool.
- A model appearing in a separate chat-creation tool does not make it available for subagents. Do not create separate chats as a workaround without an explicit user request.
- Use only advertised model/effort combinations. Currently the first six support low, medium, high and xhigh; GPT-6 Luna supports max but not ultra. Do not default to max or ultra.
- Explicitly report an unavailable selection and its substitute. Never claim a model was used unless the delegation call confirms it.

## Selection and escalation

1. For tiny tasks, doing the work in the parent can avoid delegation overhead. For useful independent documentation or inventory tasks, select GPT-6 Luna low.
2. Use GPT-6.1 Terra medium for bounded implementation with a clear contract. Use GPT-6.1 Sol medium for substantial integration.
3. Use GPT-6.1 Sol high for money calculations, accounting, trading calendars, authentication, privacy, persistence, migrations or concurrency. Add a focused independent review when the change materially affects these behaviors.
4. Use GPT-6 Sol high for an independent review with a clear specification. Reserve GPT-6 Astra high for unresolved ambiguity, difficult failures or critical methodology decisions.
5. Escalate only when evidence warrants it: an unresolved correctness issue after a focused repair, contradictory requirements, or a materially broader risk. Pass the failing case and findings to the stronger model instead of restarting discovery.
6. Use xhigh only when high effort leaves a specific difficult issue unresolved. Max/ultra require explicit user direction or an exceptional documented need and live tool support.

Fallbacks, subject to live availability:

- Luna task: GPT-6 Luna -> GPT-5.6 Luna -> GPT-6.1 Terra at low effort.
- Terra task: GPT-6.1 Terra -> GPT-5.6 Terra -> GPT-6.1 Sol at medium effort.
- Sol task: GPT-6.1 Sol -> GPT-6 Sol -> GPT-5.6 Sol, preserving the needed effort.
- Astra task: GPT-6.1 Sol high with a separate focused review; disclose that the preferred model was unavailable.
- Do not silently inherit Astra for routine tasks. If explicit model selection is unavailable, disclose the limitation and avoid unnecessary agents.

## Routing by actual project path

| Paths / behavior | Default delegation | Verification focus |
| --- | --- | --- |
| `README.md`, `docs/**`, `ai-routing.md` | GPT-6 Luna low | Accuracy against code; financial specifications need Sol high |
| `app/assets/main.css` | GPT-6 Luna low/medium | Visual inspection, responsive states |
| `app/app.vue` layout, navigation, forms | GPT-6.1 Terra medium | UI states and typecheck; one file owner |
| `app/app.vue` shared state, journal, privacy, stale previews | GPT-6.1 Sol high | Data flow, invalidation, user consent, persistence |
| `shared/types.ts`, `server/services/validation.ts`, `server/api/**` | GPT-6.1 Sol high | Contract consistency, validation and legacy input compatibility |
| `shared/engine.ts` | GPT-6.1 Sol high | Sizing, risk, fees, lots, deterministic signal regressions |
| `shared/calendar.ts` | GPT-6.1 Sol high | Official calendar sources, coverage gaps and horizon boundaries |
| `shared/journal.ts`, `server/services/journal.ts`, `server/services/portfolio.ts` | GPT-6.1 Sol high | Partial fills, fees, cost basis, duplicate handling and constraints |
| `server/services/store.ts` | GPT-6.1 Sol high | Transactions, migrations, concurrency and data preservation |
| `server/services/market.ts`, `server/services/universe.ts` | GPT-6.1 Sol high | Freshness, caching, liquidity/history filters and bounded provider usage |
| `shared/research.ts`, `server/services/research.ts` | GPT-6.1 Terra medium for isolated parsing; Sol high for signal/data boundaries | Dates, incomplete responses, source attribution and provider quota |
| `shared/manual-prompts.ts`, `server/services/manual-prompts.ts`, `server/api/prompts.post.ts` | GPT-6.1 Sol high | Export allowlists, opt-in private fields, stale context and untrusted provider text |
| `analytics/**` | GPT-6.1 Sol high | Look-ahead, execution assumptions, calendar/horizon parity; Astra for unresolved methodology |
| `server/middleware/access.ts`, authentication/deployment/database configuration | GPT-6.1 Sol high | Access control, secrets and hosted persistence |
| `scripts/runtime.mjs`, `nuxt.config.ts`, package manifest/lockfile | GPT-6.1 Sol medium; high for security/dependency/deployment changes | Runtime compatibility and affected build behavior |
| `scripts/validate-arjum.ps1`, `scripts/check-arjum-samples.ps1`, `scripts/smoke.mjs` | GPT-6.1 Terra medium; high for secrets, quota or persistent writes | Safe fixtures, bounded calls and no credential output |
| `tests/*.test.ts` | Match the risk of the behavior being tested | Financial test design uses Sol high; Luna can run/report a predefined check |

The UI currently lives in one `app/app.vue`, not separate pages/components.
Tests currently live directly under `tests/`, not `tests/financial/`.
Revisit this table if the structure changes.

## Delegation mechanics and token discipline

- Set `model` and `reasoning_effort` explicitly. The current tool requires `fork_turns: "none"` for these overrides; a full-history fork inherits the parent and does not accept overrides.
- Give a concise, self-contained task: objective, owned paths, agreed interfaces, relevant repository references, constraints, checks and completion criteria.
- Do not include secrets, private portfolio dumps or the full conversation. Let the worker read only relevant files.
- Prefer one or two useful workers. Use three only for genuinely independent ownership and available slots. Do not duplicate their investigation in the parent.
- Assign one owner per file. Agree shared types and interfaces before parallel edits. The parent owns integration.
- Reuse an existing agent only when its model and task context remain suitable; a follow-up message does not switch its model.
- Reports should contain changed files, checks actually run, unresolved risks and blockers. Avoid repeated broad scans and lengthy recaps.
- Run focused meaningful checks during implementation, then an integrated suite/typecheck/build when appropriate. Repeat only for new changes or unresolved failures.
- State the actual delegated model and effort in progress/final reporting. Do not guess the parent model or claim measured cost/token savings without measurements.
- Do not launch feature work merely to demonstrate model routing.

Example for an authorized UI task with an agreed contract:

```json
{
  "task_name": "ui_prompt_preview",
  "fork_turns": "none",
  "model": "gpt-6.1-terra",
  "reasoning_effort": "medium",
  "message": "Read ai-routing.md. Own app/app.vue and app/assets/main.css only. Implement the agreed prompt preview UI contract supplied with this task. Do not change financial logic or saved user data. Verify typecheck and preview states. Return changed files, checks and blockers concisely."
}
```

## Suggested allocation when the user resumes the interrupted work

Sequence by dependencies and slot availability; this is not permission to resume.

1. Calendar, horizon and journal contracts: GPT-6.1 Sol high.
2. Manual prompt templates, allowlists and privacy: GPT-6 Sol high or GPT-6.1 Sol high.
3. Vue workflow after contracts stabilize: GPT-6.1 Terra medium; raise to Sol high for shared-state correctness.
4. Documentation and test instructions: GPT-6 Luna low, only if substantial enough to delegate.
5. Parent integrates; use a narrow Astra high review only for unresolved financial, calendar or privacy issues.

## Non-negotiable project rules

- Keep provider keys server-side; never in public runtime config, browser storage, logs, prompts, exports or committed files.
- Separate synthetic examples, provider recommendations and calculated signals.
- Signals need source timestamps, strategy version, prerequisites, expiry and explicit reasons.
- Missing, stale or incomplete market data must block actionable signals. Do not silently guess unsupported trading-calendar coverage.
- Use deterministic financial calculations. No language-model-generated prices, quantities or probabilities.
- Round positions down to valid lots; include fees, slippage, tick rules and portfolio constraints. Preserve fill accounting and idempotency.
- Backtests must prevent look-ahead bias, address survivorship bias and include adverse execution cases. Disclose dataset/corporate-action limitations rather than implying validation.
- Use isolated test databases and fixtures; do not alter the user's real portfolio or spend provider quota needlessly.
- Manual AI exports use explicit field allowlists and opt-in private information. Copying is user initiated. Treat provider text and pasted model output as untrusted data.
- Persist hosted application data outside serverless local files. Long backtests run separately from web requests.
- Verify changed behavior with appropriate type checks, builds and meaningful tests. Never claim checks ran when they did not; interrupted work is not completed work.
- No automatic brokerage execution in the initial scope.

## References

- User-approved model list and effort selection: request dated 2026-10-27.
- Actual model/effort availability: current `collaboration.spawn_agent` tool schema; recheck each session.
- [OpenAI model guidance](https://learn.chatgpt.com/docs/models): general model-selection reference. The assignments above are local project policy, not an official pricing table.
