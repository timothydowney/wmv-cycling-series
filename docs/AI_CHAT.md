# AI Chat Feature

**Status:** Live (Admin-only beta)  
**Model:** Google Gemini (configurable via `GEMINI_MODEL`, currently `gemini-2.5-flash-preview-05-20`)  
**Added:** v0.12.0 (February 2026)

---

## 1. Overview

The AI Chat feature provides a conversational interface for querying WMV Cycling Series competition data. Admins can ask natural-language questions about leaderboards, standings, athlete performance, segment records, and more. The AI uses Gemini's **function calling** (tool use) to query the database and synthesize answers — it acts as an intelligent query planner, not a database dump.

### Example Interactions

- *"Who is leading the current season?"* → calls `get_current_season` + `get_season_standings`
- *"Compare Tim and Michael's performance this season"* → calls `compare_athletes` + `get_participant_history` (×2)
- *"What was the fastest time on Box Hill?"* → calls `get_segment_records`
- *"What other rides did Steve do this week?"* → calls `get_strava_recent_activities` (live Strava API)

---

## 2. Architecture

```
┌─────────────┐     tRPC mutation      ┌──────────────────┐
│   React UI   │ ────────────────────► │  chatRouter (tRPC) │
│  ChatPanel   │ ◄──────────────────── │  adminProcedure    │
└─────────────┘     JSON response       └────────┬─────────┘
                                                 │
                                        ┌────────▼─────────┐
                                        │   ChatService     │
                                        │  (orchestrator)   │
                                        └────────┬─────────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              │                  │                  │
                     ┌────────▼────────┐ ┌───────▼──────┐  ┌───────▼──────┐
                     │  Gemini API     │ │ ChatToolRunner│  │ChatContext   │
                     │  (LLM calls)    │ │ (function     │  │  Builder     │
                     │                 │ │  execution)   │  │(system prompt│
                     └─────────────────┘ └───────┬──────┘  └──────────────┘
                                                 │
                                    ┌────────────┼────────────┐
                                    │            │            │
                              ┌─────▼──┐  ┌─────▼──────┐  ┌──▼───────────┐
                              │Existing│  │  Direct DB  │  │ Strava API   │
                              │Services│  │  Queries    │  │ (live calls) │
                              └────────┘  └────────────┘  └──────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| [server/src/services/ChatService.ts](../server/src/services/ChatService.ts) | Orchestrates Gemini conversation, manages function-calling loop |
| [server/src/services/ChatToolDefinitions.ts](../server/src/services/ChatToolDefinitions.ts) | Declares tool schemas in Gemini's format (17 tools) |
| [server/src/services/ChatToolRunner.ts](../server/src/services/ChatToolRunner.ts) | Executes tools — DB queries and Strava API calls |
| [server/src/services/ChatContextBuilder.ts](../server/src/services/ChatContextBuilder.ts) | Builds system prompt with competition rules and context |
| [server/src/services/ChatRateLimiter.ts](../server/src/services/ChatRateLimiter.ts) | In-memory per-user rate limiting |
| [server/src/routers/chat.ts](../server/src/routers/chat.ts) | tRPC router with `adminProcedure` guard |
| [src/components/ChatPanel.tsx](../src/components/ChatPanel.tsx) | React chat UI with message history |
| [src/components/ChatMessage.tsx](../src/components/ChatMessage.tsx) | Renders individual messages with markdown |
| [src/components/ChatPanel.css](../src/components/ChatPanel.css) | Chat-specific styles |

### Request Flow

1. User types a question in `ChatPanel.tsx`
2. Frontend sends `chat.sendMessage` tRPC mutation with message + conversation history
3. `chatRouter` verifies admin auth and rate limits
4. `ChatService.chat()` sends the message to Gemini with the system prompt and tool declarations
5. Gemini may respond with **function calls** (tool requests) or a **text response**
6. If function calls: `ChatToolRunner.execute()` runs each tool, results are sent back to Gemini
7. Loop repeats (up to 8 rounds) until Gemini produces a final text response
8. Response returned to frontend and rendered with markdown (via `react-markdown` + `remark-gfm`)

---

## 3. Tool Inventory (17 Tools)

### 3.1 Season & Week Tools (4 tools)

| Tool | Parameters | Delegated To | Notes |
|------|-----------|-------------|-------|
| `list_seasons` | — | Direct DB query | Simple query; no existing service method returns this exact shape |
| `get_current_season` | — | Direct DB query | Date-based lookup + fallback to most recent |
| `get_season_weeks` | `season_id` | Direct DB query | Joins `week` + `segment` tables, adds computed `type` field |
| `get_week_by_name_and_season` | `week_name`, `season_name?` | Direct DB query | Fuzzy matching on week/segment names |

### 3.2 Leaderboard & Scoring Tools (2 tools)

| Tool | Parameters | Delegated To | Notes |
|------|-----------|-------------|-------|
| `get_week_leaderboard` | `week_id` | **`LeaderboardService.getWeekLeaderboard()`** | Fully delegates to existing service |
| `get_season_standings` | `season_id` | **`StandingsService.getSeasonStandings()`** | Delegates with `includeProfilePictures: false` for performance |

### 3.3 Participant Tools (3 tools)

| Tool | Parameters | Delegated To | Notes |
|------|-----------|-------------|-------|
| `list_participants` | — | Direct DB query | Simple select with name/weight/active |
| `get_participant_profile` | `athlete_name` | **`ProfileService.getAthleteProfile()`** | Full delegation — career stats, season stats, PRs |
| `get_participant_history` | `athlete_name`, `season_id?` | **Mixed** — Direct DB + `ScoringService.calculateWeekScoring()` per week | See [Duplication Analysis](#41-participant-history) |

### 3.4 Effort & Performance Tools (3 tools)

| Tool | Parameters | Delegated To | Notes |
|------|-----------|-------------|-------|
| `get_effort_details` | `week_id`, `athlete_name` | Direct DB query | Queries `activity` + `segmentEffort` tables directly |
| `compare_athletes` | `athlete_names[]`, `week_id?`, `season_id?` | **`ScoringService`** + **`StandingsService`** | Delegates scoring, builds comparison view |
| `get_watts_per_kg_ranking` | `week_id` | Direct DB query | Custom aggregation — no existing service for this |

### 3.5 Analysis & Trends Tools (3 tools)

| Tool | Parameters | Delegated To | Notes |
|------|-----------|-------------|-------|
| `get_improvement_report` | `season_id`, `last_n_weeks?` | **Mixed** — Direct DB + `ScoringService` | Complex analysis with fallback strategies |
| `get_segment_records` | `segment_name` | Direct DB query | Multi-join across result/week/season/participant |
| `get_jersey_winners` | `season_id` | **`JerseyService`** | Full delegation to `getYellowJerseyWinner()` + `getPolkaDotWinner()` |

### 3.6 Live Strava Tools (2 tools)

| Tool | Parameters | Delegated To | Notes |
|------|-----------|-------------|-------|
| `get_strava_recent_activities` | `athlete_name`, `days_back?` | **Strava API** via `stravaClient` + `tokenManager` | Live external call, rate-limited |
| `get_strava_athlete_profile` | `athlete_name` | **Strava API** via `stravaClient` | Live external call |

---

## 4. Service Reuse Audit

### Assessment Summary

The tool runner does a **good job** of reusing existing services for the core high-value operations:

- **`get_week_leaderboard`** → Fully delegates to `LeaderboardService` (includes scoring, effort breakdowns, ghost comparisons)
- **`get_season_standings`** → Fully delegates to `StandingsService` (with profile picture optimization)
- **`get_participant_profile`** → Fully delegates to `ProfileService` (career stats, season-by-season breakdown, PRs, streaks, jersey wins)
- **`get_jersey_winners`** → Fully delegates to `JerseyService`
- **`compare_athletes`** → Uses `ScoringService` and `StandingsService`

This means the most complex and correctness-critical scoring logic is **not duplicated** — it flows through the same code paths as the main application. This is the right design choice.

### 4.1 Participant History

**Status:** Mixed delegation — partially duplicated

`getParticipantHistory()` does its own DB query for results, then calls `ScoringService.calculateWeekScoring()` per week to get rank and points. This means it:

- Recalculates scoring for every week the athlete participated in (could be 20+ calls)
- Doesn't use `ProfileService` or `StandingsService` which already aggregate this data

**Recommendation:** This is an acceptable tradeoff. The `ProfileService.getAthleteProfile()` doesn't return the week-by-week detail that `getParticipantHistory()` provides (individual week times, per-week PR status, etc.). A potential optimization would be to add a batch scoring method to `ScoringService` that scores multiple weeks in one pass, but the current N-call approach is fast enough with SQLite (each call is ~1ms).

### 4.2 Direct DB Queries

Several tools issue direct DB queries rather than going through services:

| Tool | Direct Query | Could Reuse? |
|------|-------------|-------------|
| `list_seasons` | Direct select from `season` | `SeasonService.getAllSeasons()` exists — minor opportunity to delegate |
| `get_current_season` | Date-based season lookup | No existing method for "current season by date" |
| `get_season_weeks` | Join `week` + `segment` | No existing service returns this exact shape (WeekService.getAllWeeks uses `ctx.orm` differently) |
| `get_week_by_name_and_season` | Fuzzy segment name search | No existing service for fuzzy week lookup |
| `list_participants` | Direct select from `participant` | `ParticipantService.getAllParticipantsWithStatus()` exists but returns different shape |
| `get_effort_details` | Direct `activity` + `segmentEffort` query | `LeaderboardService` includes effort breakdowns but only within full leaderboard context |
| `get_watts_per_kg_ranking` | Custom aggregation query | No existing service — unique to chat |
| `get_segment_records` | Multi-table join | No existing service — unique to chat |
| `get_improvement_report` | Complex analysis with scoring | No existing service — unique to chat |

**Assessment:** Most direct queries are justified because:
1. The exact data shape needed doesn't exist in any service
2. The queries are simple selects that don't duplicate scoring logic
3. Creating wrapper service methods just for chat would add unnecessary abstraction

**The one clear refactor candidate** is `list_seasons`, which could trivially delegate to `SeasonService.getAllSeasons()`. The value is low since it's a simple select, but it would be more consistent.

### 4.3 Scoring Logic Integrity

The critical scoring formula: `(base_points + participation_bonus + pr_bonus) × multiplier`

This is **NOT reimplemented** in the chat tools. All scoring flows through `ScoringService.calculateWeekScoring()`, which is the single source of truth. The chat tools consume its output, transform it for the AI, but never recalculate points. This is correct.

### 4.4 Hill Climb / Time Trial Classification

The `(average_grade > 2)` threshold is used:
- In `ChatToolRunner` when labeling weeks as "Hill Climb" vs "Time Trial"
- In `JerseyService.isHillClimbWeek()` as the canonical implementation

The chat tools compute this inline: `(w.average_grade || 0) > 2 ? 'Hill Climb' : 'Time Trial'`. While this mirrors `JerseyService.isHillClimbWeek()`, it's a simple threshold check that's unlikely to diverge. For strictness, the tool runner could call `this.jerseyService.isHillClimbWeek()`, but the current approach is acceptable.

---

## 5. Fuzzy Name Matching

The tool runner includes a sophisticated name resolution system:

### Nickname Expansion

A `NICKNAME_MAP` maps common English names to their variations:
- "Mike" → matches "Michael", "Mikey", "Mick"
- "Tim" → matches "Timothy", "Timmy"
- "Bob" → matches "Robert", "Bobby", "Rob"
- (30+ nickname families covered)

### Fuse.js Integration

After nickname expansion, [Fuse.js](https://fusejs.io/) performs fuzzy matching with:
- Threshold: 0.4 (moderate fuzziness)
- Location-independent matching
- Score-based ranking of results

### Disambiguation

When multiple participants match, the system:
1. Checks for exact match first
2. Narrows by current season participation (if only one match has results → auto-resolve)
3. Returns all matches with an active-season hint for Gemini to disambiguate

This is a chat-specific capability that doesn't exist in other services. It's well-implemented and doesn't duplicate any existing logic.

---

## 6. System Prompt Design

The system prompt (`ChatContextBuilder.ts`) provides:

1. **Competition rules** — scoring formula, jersey rules, hill climb vs TT classification
2. **Response guidelines** — markdown formatting, time formatting, respectful comparisons
3. **Tool usage guidance** — prefer local data over Strava API, structured multi-section responses
4. **Dynamic context** — current date, current user's name, current season name

The system prompt is rebuilt for each API call (not cached), which ensures freshness but adds ~200 tokens per call. This is negligible at current Gemini pricing.

---

## 7. Rate Limiting

In-memory rate limiter with two windows:

| Window | Limit | Reset |
|--------|-------|-------|
| Per minute | 10 requests | Sliding 60-second window |
| Per day | 200 requests | Fixed 24-hour window |

The rate limiter lives in `ChatRateLimiter.ts` as a singleton. Since the app runs as a single Node.js instance with SQLite, in-memory limiting is sufficient.

Rate limit status is exposed to the frontend via `chat.getRateLimitStatus` and shown in the chat header ("X remaining today").

---

## 8. Frontend

### ChatPanel.tsx

- Full-page chat interface, accessed via `/chat` route (admin-guarded)
- Maintains conversation history in React state (ephemeral — lost on page reload)
- Auto-trims history at 50 messages to control token usage
- Suggested starter questions for discoverability
- Auto-scrolls on new messages
- Thinking indicator with animated dots
- Clear conversation button

### ChatMessage.tsx

- Renders user messages as plain text
- Renders AI messages as markdown via `react-markdown` + `remark-gfm` (supports tables, bold, headers, lists)
- No custom rendering for athlete names, links, or interactive elements (see [TODO #3](#todo-3-enrich-response-rendering))

---

## 9. Design Decisions

### Why Function Calling (Not RAG or Full-Context)?

1. **Precision:** The AI calls specific tools to get exactly the data it needs, rather than searching a vector store
2. **Correctness:** Tools delegate to the same scoring services as the main app — the AI can't get scoring wrong
3. **Efficiency:** Only fetches what's needed per question (e.g., one week's leaderboard, not all seasons)
4. **Extensibility:** New tools can be added without changing the AI orchestration layer

### Why 17 Tools?

The tool count is on the higher end for LLM function calling. Each tool exists because:
1. It serves a distinct user intent
2. It returns a different data shape than other tools
3. Some (like `compare_athletes`, `get_improvement_report`) do analysis that the AI would struggle to do from raw data alone

The model handles 17 tools well, typically selecting 1-3 per question. Multi-round conversations (up to 4 tool rounds) are common for comparison queries.

**Consolidation candidates** are limited — most tools are already focused on a specific task. The `get_watts_per_kg_ranking` and `get_effort_details` tools overlap slightly (both deal with effort-level metrics for a week), but serve different intents (ranking vs. individual breakdown).

### Why Gemini (Not OpenAI or Anthropic)?

1. **Cost:** Gemini 2.0 Flash is extremely cost-effective (~$0.0002 per message)
2. **Function calling:** Native structured tool use with parallel execution
3. **Context window:** 1M tokens — handles long conversations without truncation
4. **SDK:** Official `@google/genai` package with TypeScript support

---

## 10. Known Limitations

1. **No conversation persistence** — chat history is lost on page reload. This is intentional for the beta; persistent history would require a new database table.

2. **No streaming** — responses arrive as a single message after all tool rounds complete (typically 3-12 seconds). Streaming would improve perceived latency.

3. **No feedback collection** — there is no mechanism for users to rate response quality. See [TODO #1](#todo-1-feedback-collection).

4. **Response rendering is plain text/markdown** — athlete names, weeks, and segments in responses are not interactive. See [TODO #3](#todo-3-enrich-response-rendering).

5. **Strava API budget not isolated** — the chat Strava tools share the global Strava rate limit with competition data fetching. In the admin-only beta this is fine; broader rollout should add a separate chat budget.

6. **`list_seasons` doesn't delegate** — minor inconsistency; it queries the DB directly instead of using `SeasonService.getAllSeasons()`.

---

## 11. TODOs

### TODO 1: Feedback Collection

**Priority:** High  
**Effort:** Medium (2-3 days)

Currently, admin feedback is collected informally. A structured feedback mechanism would:

1. **Log all chat interactions** — store queries and responses in a `chat_interaction` table:
   ```sql
   CREATE TABLE chat_interaction (
     id INTEGER PRIMARY KEY,
     user_id TEXT NOT NULL,
     message TEXT NOT NULL,
     response TEXT NOT NULL,
     tools_used TEXT,           -- JSON array of tool names
     tool_rounds INTEGER,
     response_time_ms INTEGER,
     rating INTEGER,            -- NULL, 1 (thumbs up), -1 (thumbs down)
     feedback_text TEXT,        -- Optional free-text comment
     created_at INTEGER NOT NULL
   );
   ```

2. **Thumbs up/down UI** — add to each AI message bubble:
   - Subtle thumb icons that appear on hover
   - Optional text field on thumbs-down ("What was wrong?")
   - One-click, non-intrusive — shouldn't break the conversation flow

3. **Admin analytics dashboard** — query the interaction table to see:
   - Most common question patterns
   - Average response rating
   - Which tools are used most
   - Response time distribution
   - Questions that resulted in thumbs-down (for prompt/tool improvement)

4. **Backend changes needed:**
   - New `chat_interaction` table in Drizzle schema
   - `ChatService` to log interactions after each response
   - New tRPC mutation: `chat.rateChatResponse` (accepts interaction ID + rating)
   - New tRPC query: `chat.getInteractionStats` (admin analytics)

This is the **most actionable improvement** for the beta period. Without structured feedback, we're relying on admins to voluntarily report issues, which inevitably misses pain points.

### TODO 2: Delegate `list_seasons` to SeasonService

**Priority:** Low  
**Effort:** Minimal (15 minutes)

Replace the direct DB query in `ChatToolRunner.listSeasons()` with `SeasonService.getAllSeasons()`. Low impact but improves consistency.

### TODO 3: Enrich Response Rendering

**Priority:** Medium  
**Effort:** Medium (1-2 days)

Currently, AI responses render as plain markdown. Opportunities to enrich:

1. **Athlete name links** — when the AI mentions an athlete name, link to their profile page (`/profile/:athleteId`). This would require:
   - A post-processing step on the AI response to detect athlete names
   - Mapping names to athlete IDs (the fuzzy match system already does this)
   - Replacing plain text names with markdown links `[Tim Downey](/profile/366880)`
   - Alternatively: instruct the AI (via system prompt) to emit links when it knows the athlete ID, though this risks exposing IDs

2. **Week/segment links** — link to the relevant leaderboard page (`/leaderboard/:seasonId/weekly/:weekId`) when the AI discusses a specific week

3. **Interactive tables** — render data tables with sorting, or as mini-leaderboard cards matching the main app's visual style

4. **Jersey icons** — show 🟡 and 🔴 icons inline when the AI discusses jersey winners

**Recommended approach for athlete links:** The simplest path is to include `strava_athlete_id` in tool results that return participant data, instruct the AI to emit markdown links like `[Tim Downey](/profile/366880)`, and let `react-markdown` handle rendering them as clickable links. The system prompt already says "never expose raw Strava athlete IDs to users" — but using them in profile URLs is different from showing raw IDs in text. The URL format already exists in the app's routing.

### TODO 4: Broader Access (Phase 2)

**Priority:** Medium  
**Effort:** Small (1 day)

When ready to open chat to all authenticated users:

1. Create `authenticatedProcedure` middleware (between `publicProcedure` and `adminProcedure`)
2. Switch `chatRouter` from `adminProcedure` to `authenticatedProcedure`
3. Move nav item from admin section to general authenticated section
4. Adjust rate limits (likely lower per-user: 5/min, 50/day)
5. Add separate Strava API budget for chat

### TODO 5: Streaming Responses

**Priority:** Low  
**Effort:** Medium (2-3 days)

Use Gemini's streaming API to progressively render responses. This would reduce perceived latency from 3-12s to <1s for first token. Requires:
- Backend: switch from `generateContent` to `generateContentStream`
- Frontend: WebSocket or SSE for streaming delivery (tRPC subscriptions or raw EventSource)
- Complexity: function calling rounds would still block — streaming only helps the final text response

### TODO 6: Batch `getParticipantHistory` Scoring

**Priority:** Low  
**Effort:** Small (1-2 hours)

`getParticipantHistory()` calls `ScoringService.calculateWeekScoring()` once per week. For athletes with 20+ weeks of history, this means 20+ scoring calculations. A batch method on `ScoringService` that scores multiple weeks in a single pass would reduce overhead. In practice, SQLite handles this quickly (~1ms per week), so the impact is negligible.

---

## 12. Tool Effectiveness Assessment

### What Works Well

1. **Service delegation for core logic** — leaderboard, standings, profiles, jerseys all flow through canonical services. Scoring is never reimplemented.

2. **Fuzzy name matching** — the nickname expansion + Fuse.js system handles natural language well ("Mike" → "Michael Bello", "Tim" → "Tim Downey").

3. **Tool selection by Gemini** — the model reliably picks the right tools. The descriptive tool names and parameter descriptions guide selection effectively.

4. **Multi-round answers** — comparison queries naturally decompose into multiple tool calls (get standing for each athlete, get history for each). Gemini handles this well with up to 8 rounds.

5. **Strava API guardrails** — clear tool descriptions tell the AI to prefer local data, and the tools only activate for explicitly external queries.

6. **Performance** — most queries resolve in 3-8 seconds. The `includeProfilePictures: false` optimization on `StandingsService` is a smart example of adapting existing services for chat use.

### Areas for Improvement

1. **No feedback loop** — we can't systematically measure response quality. This is the biggest gap. See [TODO #1](#todo-1-feedback-collection).

2. **Response rendering is utilitarian** — markdown tables and text are functional but don't match the polished UI of the main leaderboard view. Athlete names should link to profile pages as a quick win.

3. **No query logging** — we can't analyze what users ask about most, making it hard to prioritize tool improvements.

4. **`getParticipantHistory` is query-heavy** — calls scoring N times. Acceptable for now but could be optimized.

---

## 13. Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Google AI API key (required for chat to work) |
| `GEMINI_MODEL` | `gemini-2.5-flash-preview-05-20` | Gemini model to use |
| `CHAT_ENABLED` | `true` | Feature flag to disable chat |
| `CHAT_RATE_LIMIT_PER_MINUTE` | `10` | Max requests per user per minute |
| `CHAT_RATE_LIMIT_PER_DAY` | `200` | Max requests per user per day |

### Cost Estimate

At current Gemini Flash pricing (~$0.10/M input tokens, ~$0.40/M output tokens):
- Typical message: ~1-2K input tokens (system prompt + history + tool results), ~200-400 output tokens
- **Estimated cost per message: ~$0.0003**
- 3 admins × 20 messages/day = ~$0.018/day = ~$0.55/month

Cost is negligible for admin-only usage. If opened to all users, monitor via token usage logs.

---

## 14. Testing

### Unit Tests

- [ChatToolRunner.test.ts](../server/src/__tests__/ChatToolRunner.test.ts) — tests each tool with in-memory SQLite
- [ChatRateLimiter.test.ts](../server/src/__tests__/ChatRateLimiter.test.ts) — tests rate limiting logic

### Manual Testing

Test against the dev database with a real `GEMINI_API_KEY`:
```bash
npm run dev
# Navigate to /chat (as admin user)
```

Key test scenarios:
- Simple questions ("Who's in first place?")
- Cross-season comparisons ("How did Tim do compared to last season?")
- Fuzzy name resolution ("Compare Mike and Will")
- Ambiguous names (multiple matches)
- Edge cases (empty results, future weeks)
- Strava API queries ("What rides did Steve do this week?")

---

## 15. Security

| Concern | Mitigation |
|---------|-----------|
| Prompt injection | System prompt is server-side only; user messages are text in the `user` role. Gemini function calling is structured — users cannot define new tools. |
| Data exfiltration | Tool results are filtered to safe fields. No tokens, no internal IDs exposed in text. |
| API key exposure | `GEMINI_API_KEY` is server-side env var only, never sent to frontend. |
| Rate abuse | In-memory rate limiter per user. Admin-only access reduces attack surface. |
| Strava token misuse | Strava calls use existing `getValidAccessToken()` pattern. Each athlete's data accessed via their own token. |
| Cost runaway | Rate limits cap daily usage. Low per-message cost ($0.0003). |

---

*Last updated: February 2026*
