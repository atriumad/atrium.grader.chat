# Research agent for the Atrium Grader: design

Date: 2026-11-10 · Status: draft for approval · App: `apps/web`

## 1. Intent

Today `POST /api/analyze` is a fixed script. It always runs the same lookups in the same order (Google Places, then social links, then competitors), builds a `Dataset`, and only then asks the model to write text. The model never decides where to look.

The goal is for the analysis to be done by an agent that, given a business, **works out what it needs to know, knows where to look for it, goes and gets it, and then builds the report using the rules published in the admin panel and the data it found.** The writing step stays, but it comes last and is grounded in what the agent actually collected.

Why now: the target UI (the "Atrium Grader — Flow" canvas) needs data the fixed script does not collect (website quality, review replies, search demand, share of local search, a dollar estimate). Adding each as another hard-coded step does not scale; each new source should be a tool the agent can choose to use.

## 2. Goals

1. The agent decides which sources to consult for a given business and why, within a fixed budget.
2. Every number in the report traces to a tool result. A source that failed or was not run shows as "sin dato", never as a plausible guess.
3. Scoring stays deterministic and comes from the admin-published rules (`ScoreConfig`). The model never sets or adjusts a score.
4. The scan screen shows the agent's real work: each tool call is a `step` event, so the UI needs no change when tools are added.
5. The result is the same `Dataset` shape plus an evidence list, so the dashboard, chat, admin log and PDF keep working.
6. Cost and time are bounded per analysis and visible in the admin panel.

## 3. Non-goals

- The agent does not write or change scoring rules, weights or tiers.
- It does not take actions with side effects (no booking, no emails, no writes outside our own log tables).
- It does not use private or logged-in data. Public sources only.
- No parallel multi-agent orchestration. One agent, one tool loop.
- The chat assistant is a separate agent and is not changed here (it can later reuse the same tools).
- Dollar figures are estimates from a published formula, never presented as measured facts.

## 4. Anti-goals (failure even if it "works")

- A report that looks complete because the model filled gaps from general knowledge.
- A run that quietly spends many paid calls on a thin signal.
- Two runs of the same business producing different scores because the agent chose different tools without that being visible (scores must be reproducible from the stored evidence).
- Vendor names in customer-facing copy (existing rule in the grader: "public listing", "market signals").

## 5. How it works

```
admin rules (ScoreConfig, AgentConfig)  ─┐
business input (name / @handle / placeId) ┼─► research agent (tool loop, budget-bound)
                                          │        │ each tool call ─► `step` events ─► scan screen
                                          │        ▼
                                          │   evidence[]  (tool results, with source + time + status)
                                          ▼        │
                                   assemble Dataset (deterministic code, not the model)
                                          │
                                          ├─► scoreAll(dataset)  (existing, deterministic)
                                          └─► streamAnalysis(dataset, evidence)  (existing writer, now also sees evidence gaps)
```

### 5.1 Phases

1. **Identify.** Resolve the business (existing logic: `decide`, `findCandidates`, choices event). This stays deterministic code, because it can ask the user to choose a location. The agent starts only once there is a confirmed business.
2. **Research (new, agentic).** The agent gets the confirmed business, a checklist of what the report needs, and the tools below. It calls tools until the checklist is satisfied or the budget is used.
3. **Assemble.** Plain code builds the `Dataset` from tool results. The model is not involved.
4. **Score and write.** Unchanged: `scoreAll` then `streamAnalysis`. The writer prompt gains one block listing which checklist items have no data.

### 5.2 The checklist (what "complete" means)

A fixed list in code, not chosen by the model. The agent is told which items are required and which are optional:

| Item | Required | Used by |
|---|---|---|
| Google listing: rating, review count, website, category, price level | yes | reputation, ticket estimate |
| Social accounts and stats for the business | yes | engagement, activity, audience, presence |
| Competitors nearby (radius 3 km) | yes | every benchmark |
| Social stats for up to 3 competitors | yes | benchmarks |
| Website audit: speed, mobile, menu, ordering, reservations, phone, schema, meta | optional | website engine |
| Review replies and recent rating trend | optional | reputation engine, leak estimate |
| Local search demand and the business's share of local results | optional | search engine, leak estimate |

Required items missing after the loop mark the run as `low confidence` (existing confidence mechanism). Optional items missing show as "sin dato".

### 5.3 Tools

Reuse what exists; each tool is a thin wrapper returning compact JSON plus a `source` and `fetchedAt`.

| Tool | Status | Notes |
|---|---|---|
| `get_google_listing` | wraps `lib/places.ts` | |
| `find_competitors` | wraps `findCompetitors` + `groupByAccount` | |
| `get_social_stats` | wraps `lib/socials.ts` (`getInstagramStats` etc.) | existing reader cache stays |
| `audit_website` | exists as `seoAudit` in `lib/chat/research.ts`; add PageSpeed from `atrium.platform` (`pagespeed-client.ts`) and the website signals from its `website-scanner` | must keep the allow-list that only fetches hosts from the analysis |
| `check_local_ranking` | exists as `check_google_ranking` (organic only) | local-pack share needs a new provider |
| `get_review_signals` | new | needs a reviews provider (open question) |
| `get_search_demand` | new | needs a keyword-volume provider (open question) |
| `record_finding_unavailable` | new | lets the agent state that a source returned nothing, so the gap is explicit instead of silent |

The tool definitions and the per-tool enable flags live next to the existing `AgentConfig.tools` so the admin can switch a tool off (for cost or while a provider is down).

### 5.4 Budget and limits

Defaults, editable in the admin agent config:
- max 12 tool calls per analysis, max 90 seconds of research (route `maxDuration` is 120 s today).
- per-tool caps (e.g. one social lookup per account, one website audit per entity, competitors limited to 3 as today).
- a repeated identical call returns the cached result and does not count as a new external request.
- on budget exhaustion the agent must stop and the run continues with what it has.

### 5.5 Streaming contract

Unchanged from the current implementation:
`status` (legacy text), `step {id,label,state,meta?}`, `choices`, `data`, `text`, `error`. Each tool call emits `step running` before and `done`/`skipped` after, with `meta` set from the tool result (never from the model). A new `evidence` event is not needed on the wire; evidence is stored server-side with the analysis.

### 5.6 Evidence and logging

Each tool result is stored with the analysis: tool name, inputs, status (`ok`/`empty`/`error`), compact output, duration, estimated cost. This reuses the `lookup_logs` table and `logLookup` helper already added for the admin "Búsquedas" page; the page then shows the agent's full trail per analysis. The admin overview gains average tool calls and cost per analysis.

### 5.7 Dollar estimate

A pure function in `packages/shared` computing, from evidence only: monthly searches × share not captured × conversion assumption × ticket estimate × 12. Every assumption is a field in `ScoreConfig` (editable, versioned like the other rules). If any input is missing the figure is not shown; the UI says which input is missing. It is always labelled "estimación" with its formula one tap away.

## 6. Constraints

- Analysis today defaults to `ANALYSIS_PROVIDER=claude-cli` (a local CLI). A tool loop needs the Anthropic API (`ANALYSIS_PROVIDER=api`, `ANTHROPIC_API_KEY`). The agent therefore runs only in API mode; the CLI mode keeps the current fixed pipeline as a fallback, so local development without a key still works.
- Vercel function limit: the route already sets `maxDuration = 120`. Research time must stay well under that so the writing step fits.
- Rate limits on external providers (ScrapeCreators, Google) are already a known pain point (admin login showed the same class of problem). The budget and cache above are the mitigation; the existing `rate-limit.ts` stays in front of the route.
- Customer-facing text must not name vendors.
- Scoring reproducibility: given the stored evidence and the stored `ScoreConfig`, `scoreAll` must return the same score.

## 7. Decisions made here (my calls, to confirm)

1. Identification stays deterministic code and runs before the agent, because it can interrupt to ask the user to pick a location.
2. The checklist is fixed in code; the agent chooses the order and whether to try optional items, not what the report needs.
3. Assembly of the `Dataset` is code, not the model, to keep numbers faithful.
4. Fixed pipeline remains as fallback (CLI mode, or if the agent run fails entirely).
5. Starting model: the same `ANTHROPIC_MODEL` already used; a cheaper model for the research loop is a later optimisation.

## 8. Left to the builder

- Tool input/output schemas and exact prompt wording (must keep the rules: never invent, no vendor names, state gaps).
- How the agent loop is written (manual loop like `api/chat/route.ts` vs. the SDK tool runner).
- Cache keys and TTLs per tool.
- Admin UI for per-tool toggles and budget fields (follow the existing agent-config page).
- Tests: deterministic assembly and scoring from fixture evidence; tool wrappers with recorded responses; budget exhaustion; a tool failing mid-run.

## 9. Open questions (only the owner can answer)

1. **Reviews provider:** which source for review replies and rating trend (DataForSEO, a ScrapeCreators Google endpoint, or other)? Without one, the "unanswered reviews" leak is not shown.
2. **Search demand provider:** DataForSEO or Google Ads Keyword Planner? Without one, search demand and share of search are not shown.
3. **Budget per analysis:** the maximum acceptable external cost and time per free analysis (the default of 12 calls / 90 s is a guess).
4. **Dollar estimate defaults:** who sets the initial conversion and ticket assumptions, and is a figure acceptable when the ticket is only estimated from Google's price level?

## 10. Suggested build order

1. Wrap existing lookups as tools and run them through a loop that produces the same `Dataset` as today (no new data), with `step` events coming from tool calls. Behavior should match the current pipeline, which makes it safe to compare.
2. Add `audit_website` with PageSpeed and website signals ported from `atrium.platform`.
3. Add evidence storage and the extended admin "Búsquedas" page.
4. Add reviews and search-demand tools once providers are chosen.
5. Add the dollar estimate and its admin-editable assumptions.
