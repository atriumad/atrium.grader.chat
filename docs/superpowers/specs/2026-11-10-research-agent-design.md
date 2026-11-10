# Atrium Research Agent: an independent service

Date: 2026-11-10 · Status: draft v2 for approval · Supersedes v1 (agent as a step inside the grader)

## 1. Intent

The agent is **its own service**, not a part of the grader. It receives a request, decides which sources to consult, gathers the data, and returns it with evidence. Any Atrium application can call it. **Who is calling decides what it may touch**:

| Caller | Profile | Sources the agent may use |
|---|---|---|
| Grader (public web app) | `public` | Public data only: Google listing, public website, public social profiles, public search |
| Atrium app (agency system) | `internal` | Everything in `public`, plus private APIs for an agency client: Metricool and similar |
| Future apps | new profile | Whatever their profile grants |

The agent does **not** score, write reports or know about any screen. It returns data plus evidence. Each application scores and presents on its own (the grader scoring already lives in `atrium.platform`; the grader keeps its writer).

Why: v1 buried the agent inside `/api/analyze`, so it could only ever serve the grader. The agent is meant to be extended across the whole product, and the private data of agency clients must never be reachable from a public page.

## 2. Goals

1. One service, one API, many callers. Adding a caller or a source does not change the others.
2. **Access is enforced by the service**, from the caller's credential. A caller cannot widen its own access by what it asks.
3. The agent chooses which allowed tools to use for a request, within a budget. The set of required facts is fixed per request type, not chosen by the model.
4. Every value returned traces to a tool result with source, time and status. A source that failed or was skipped appears as a gap, never as a guess.
5. Progress is observable: each tool call is a streamed event, so the grader's scan screen is fed by the service itself.
6. Cost, time and tool trail per request are logged and visible in the admin.

## 3. Non-goals

- No scoring, no report writing, no UI formats inside the agent.
- No side effects on external systems (no posting, booking, emails). Read-only tools in this version.
- No multi-agent orchestration. One agent, one tool loop per request.
- The chat assistant is not rewritten here. It later becomes another caller (or reuses the same tools).

## 4. Anti-goals (failure even if it "works")

- A private-profile tool reachable by a public caller, by any path (including prompt injection through web content the agent reads).
- Data from one agency client leaking into the answer for another.
- Plausible values filled from the model's general knowledge.
- Runaway spend on a thin signal.
- Two runs of the same input giving different data without the evidence showing why.

## 5. Architecture

```
Grader web ──┐   POST /v1/research  (API key → caller profile)
Atrium app ──┼──────────────────────────────────────────────┐
Other apps ──┘                                               ▼
                                          ┌──────────────────────────────┐
                                          │  AGENT SERVICE (apps/agent)  │
                                          │  1. authenticate → Profile   │
                                          │  2. build tool set from      │
                                          │     Profile ∩ request type   │
                                          │  3. tool loop (budget-bound) │
                                          │  4. assemble result+evidence │
                                          └──────────┬───────────────────┘
                              streams events ◄───────┤
                                                     ▼
                        tools: google_listing · competitors · social_public ·
                        website_audit · web_search · (internal) metricool · …
```

### 5.1 Placement

New workspace `apps/agent` in this monorepo, deployed on its own, exposing HTTP. It imports shared types from `packages/shared` and moves the reusable lookup code out of `apps/web` (`places`, `socials`, `competitors`) into a package both can use during the transition (`packages/sources`). `apps/web` stops calling lookups directly and calls the service.

### 5.2 Request and response

```
POST /v1/research
Authorization: Bearer <api key>
{
  "type": "business_profile",          // request type: fixes the required facts
  "subject": { "placeId": "..." } | { "name": "...", "city": "..." } | { "instagram": "@..." } | { "clientId": "..." },
  "options": { "stream": true }
}
```

Response (or NDJSON stream): `step {id,label,state,meta}` events while it works, then one `result`:

```
{
  "subject": {...resolved identity...},
  "facts": { ...typed data per request type... },
  "gaps":  [ { "fact": "reviewReplies", "reason": "no_provider" | "tool_failed" | "not_permitted" | "budget" } ],
  "evidence": [ { "tool", "input", "status": "ok|empty|error", "source", "fetchedAt", "durationMs", "costCents" } ],
  "usage": { "toolCalls", "durationMs", "costCents" },
  "confidence": "high|medium|low"
}
```

`not_permitted` is reported as a gap too, so a caller can show "needs a connected account" without learning anything private.

**Identification stays interactive.** If the subject is ambiguous (a franchise), the service returns `{ "needsChoice": [places...] }` and the caller re-sends with a `placeId`. The service never guesses silently; the grader shows the same location picker as today.

### 5.3 Profiles and access (the core rule)

An API key maps to a **caller record** stored server-side:

```
caller: { id, name, profile: "public" | "internal" | ..., allowedTools: [...],
          allowedRequestTypes: [...], budget: { maxToolCalls, maxSeconds, maxCostCents },
          rateLimit, active }
```

Rules, enforced in code before the model sees anything:
1. The tool list given to the model is `profile tools ∩ allowedTools ∩ tools valid for the request type`. A tool that is not in the list does not exist for that run.
2. Private tools require a `clientId` in the subject and check that the caller may access that client. Credentials for private APIs (Metricool tokens) are fetched server-side per client at call time and are **never** passed through the model, logged, or returned.
3. The model cannot change the profile, add tools, or raise the budget. Web content and tool outputs are untrusted data: they are wrapped as data in the prompt, and tool arguments are validated against schemas and allow-lists (for example, the website tool only fetches hosts belonging to the subject).
4. Keys are stored hashed, can be revoked, and every request is logged with the caller id.

### 5.4 Tools

Each tool is a registered unit: name, input schema, output schema, `profile` (public/internal), cost estimate, timeout, cache key/TTL, and an on/off switch in the admin. Output is always compact JSON plus `source` and `fetchedAt`.

| Tool | Profile | Notes |
|---|---|---|
| `google_listing` | public | wraps `lib/places` |
| `find_competitors` | public | wraps `findCompetitors` + account grouping |
| `social_public` | public | Instagram/Facebook/TikTok/YouTube stats; site links first, then name-validated search fallback |
| `website_audit` | public | speed, mobile, menu, ordering, schema; host allow-list |
| `web_search` | public | for ranking and local presence |
| `reviews_signals` | public | **provider not chosen** (open question) |
| `search_demand` | public | **provider not chosen** (open question) |
| `metricool_*` | internal | private metrics for an agency client; added when the internal caller is built |

### 5.5 Request types

A request type is a fixed contract: the facts it must return, the tools it may use, and its default budget. First one:

`business_profile` (what the grader needs): listing, social stats, competitors, competitor social stats; optional website audit, review signals, search demand. Required facts missing after the loop set `confidence: low` and appear in `gaps`. New products add new types (for example `client_performance` for the internal profile) without touching this one.

### 5.6 The loop

A manual tool loop with the Anthropic API (the existing chat route is the reference), with: max tool calls and seconds from the caller's budget, schema validation on every tool call, identical calls served from cache, and a hard stop on budget exhaustion that returns what it has. The model decides the order and whether to try optional facts; it does not decide what is required. Result assembly is code, not the model, so numbers are faithful.

### 5.7 Streaming and observability

Per tool call, `step running` then `done|skipped`, with `meta` built from the tool result (never from the model). Evidence and usage are persisted per request in the existing `lookup_logs` model, extended with `caller_id` and `request_id`, so the admin "Búsquedas" page shows the trail per request and an overview of cost and calls per caller.

### 5.8 Failure behavior

A failing tool yields a `gap` with `tool_failed` and the cause class (`rate_limited`, `out_of_credits`, `timeout`, `not_found`), never an empty success. This matters: today an exhausted provider balance (HTTP 402) looks like "this business has no Instagram". Provider failures must be distinguishable from real absence everywhere.

## 6. Migration from the current grader

1. Extract lookups into `packages/sources` (no behavior change). Fix the silent-error fallback so provider failures surface.
2. Build `apps/agent` with auth, caller table, tool registry, and the `business_profile` type running the **same fixed sequence as today** as a first implementation. Same data as now, now behind the API.
3. Point the grader at the service. Keep the in-process pipeline as a fallback behind a flag, so both can be compared with the provider benchmark.
4. Make the loop agentic (the model chooses tools) once the contract is stable; compare against step 2 with the benchmark.
5. Add the internal profile and the first private tool (Metricool) with its own caller, once the credential store and client-access rule exist.
6. Add new tools (website audit, reviews, search demand) as they get providers.

## 7. Constraints

- The agentic loop needs the Anthropic API. The in-process fixed pipeline remains the fallback for local development without a key.
- Vercel function time limits apply to each deployment. A streaming endpoint with a budget under the limit is required; if research outgrows it, move to a queue with polling.
- Customer-facing text produced by callers must not name data vendors; the agent returns neutral source labels (`public listing`, `public profile`), with vendor names only in admin logs.
- Provider rate limits and credits are a known problem (the benchmark ran out of balance). Budgets, caching and the failure classes in 5.8 are the mitigation.

## 8. Left to the builder

- Exact tool schemas, prompt wording, cache keys and TTLs.
- Where caller records and hashed keys live (the existing Supabase project is the natural place).
- Admin screens for callers, tools and budgets (follow the existing agent-config page).
- Tests: auth and profile isolation (a public key can never list or call an internal tool), schema validation, budget exhaustion, tool failure mid-run, deterministic assembly from fixture evidence.

## 9. Open questions (only the owner can answer)

1. **Internal client access rule:** how does the Atrium app prove which agency client a user may see (client ownership in Supabase, roles)? Needed before any private tool.
2. **Where do Metricool credentials live today** (per client in Supabase, in `atrium.platform`)? The agent needs a server-side way to read them.
3. **Reviews provider** and **search demand provider** (DataForSEO, a ScrapeCreators endpoint, other). Without them those facts stay gaps.
4. **Default budget** per public request (the 12 calls / 90 s of v1 is a guess) and monthly spend cap per caller.
5. **Rate limits for the public profile**: the grader is open to anonymous users; per-IP limits stay in the grader, but the service also needs a per-caller cap.

## 10. Suggested build order

1. `packages/sources`: extract lookups, classify provider errors (step 1 above).
2. `apps/agent` skeleton: key auth, caller table, tool registry, `business_profile` with today's fixed sequence, NDJSON stream.
3. Grader calls the service behind a flag; benchmark old vs new.
4. Agentic loop on top, same contract.
5. Internal profile + first private tool.
