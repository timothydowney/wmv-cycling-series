# AI Chat Feature — Implementation Plan

**Date:** February 2026  
**Status:** Planning  
**Model:** Gemini 2.0 Flash  
**Audience:** Admin-only (Phase 1), all users (Phase 2)

---

## 1. Feature Overview

Add a conversational AI chat interface to the WMV Cycling Series app, powered by Google's Gemini 2.0 Flash. Users can ask natural-language questions about competition data, such as:

- "Who won the last Box Hill hill climb during Winter 2026 season?"
- "Who was the most improved on last week's TT?"
- "Who had the highest watts/kg this season?"
- "What's Tim Downey's season ranking compared to last season?"
- "Show me the top 3 PR bonus earners this season"
- "How does Ava's average hill climb time compare to Will's?"

The AI will have access to **all local database data** (seasons, weeks, results, segment efforts, participants, scores) plus the ability to make **live Strava API calls** using stored athlete tokens for richer data when needed.

---

## 2. Data Inventory — What the AI Can Access

### 2.1 Local Database (Primary — always available, fast)

| Table | Key Fields | Chat Use Cases |
|-------|-----------|----------------|
| `season` | id, name, start_at, end_at | "Which season are we in?", "How many weeks in Fall 2025?" |
| `week` | id, season_id, week_name, segment_id, required_laps, start_at, end_at, multiplier, notes | "What segment is this week?", "When was the last hill climb?" |
| `segment` | strava_segment_id, name, distance, average_grade, total_elevation_gain, climb_category | "Which segments are hill climbs?", "How long is Alpe du Zwift?" |
| `participant` | strava_athlete_id, name, weight, active | "Who's in the competition?", "What's Tim's weight?" |
| `activity` | id, week_id, strava_athlete_id, strava_activity_id, start_at, device_name, athlete_weight, validation_status | "What device does Steve use?", "When did the activity happen?" |
| `segment_effort` | activity_id, effort_index, elapsed_seconds, start_at, pr_achieved, average_watts, average_heartrate, max_heartrate, average_cadence, device_watts | **Rich performance data** — watts, HR, cadence, PR status, lap times |
| `result` | week_id, strava_athlete_id, activity_id, total_time_seconds | Final qualifying times per participant per week |
| `participant_token` | strava_athlete_id, expires_at | Token availability (not the tokens themselves!) |

**Computed data** (via existing services, not stored):
- **Scoring**: rank, base points, PR bonus, participation bonus, multiplier, total points (computed per request by `ScoringService`)
- **Season standings**: total points, weeks completed, polka dot wins (via `StandingsService`)
- **Jerseys**: Yellow jersey (most points), Polka Dot jersey (most hill climb wins) (via `JerseyService`)
- **Ghost comparisons**: Week-over-week same-segment lap comparisons (via `GhostService`)
- **Profile stats**: Career bests, streaks, per-season stats (via `ProfileService`)
- **Watts/kg**: Calculable from `segment_effort.average_watts` ÷ `activity.athlete_weight`

### 2.2 Live Strava API (Secondary — on-demand, rate-limited)

For questions that require data NOT in the local database, the chat can make Strava API calls using stored athlete tokens. This is more powerful but slower and rate-limited.

| Strava Endpoint | What It Provides | Example Questions |
|----------------|------------------|-------------------|
| `GET /athlete/activities` | Recent activities beyond competition scope | "What other rides did Tim do this week?" |
| `GET /activities/{id}` | Full activity detail with all segment efforts | "What was the average power for non-competition segments?" |
| `GET /athletes/{id}` | Athlete profile (bio, location, FTP if set) | "Where is Steve from?" |
| `GET /segments/{id}` | Segment details (leaderboards, starred) | "What's the KOM time on Box Hill?" |

**Important constraints for Strava fetches:**
- Each athlete's data requires **their personal token** (via `getValidAccessToken()` from `tokenManager.ts`)
- Strava rate limit: 100 requests per 15 minutes, 1000 per day (per app)
- The AI must decide if a Strava call is needed vs. answering from local data
- Token refresh is handled automatically by `getValidAccessToken()`

### 2.3 Data NOT Available (Be Honest with Users)

The AI should clearly state when it cannot answer:
- Private athlete data for non-connected participants
- Historical data from before participants joined the competition
- Real-time live activity tracking
- Strava social data (kudos, comments)
- Training plans or coaching advice (out of scope)

---

## 3. Architecture

### 3.1 High-Level Flow

```
┌─────────────┐     tRPC mutation      ┌──────────────────┐
│   React UI   │ ────────────────────► │  chatRouter (tRPC) │
│  ChatPanel   │ ◄──────────────────── │  adminProcedure    │
└─────────────┘     streaming/response  └────────┬─────────┘
                                                 │
                                        ┌────────▼─────────┐
                                        │   ChatService     │
                                        │  (orchestrator)   │
                                        └────────┬─────────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              │                  │                  │
                     ┌────────▼────────┐ ┌───────▼──────┐  ┌───────▼──────┐
                     │  Gemini API     │ │  Tool Runner  │  │  Context     │
                     │  (LLM calls)    │ │  (function    │  │  Builder     │
                     │                 │ │   calling)    │  │  (DB queries)│
                     └─────────────────┘ └───────┬──────┘  └──────────────┘
                                                 │
                                    ┌────────────┼────────────┐
                                    │            │            │
                              ┌─────▼──┐  ┌─────▼──┐  ┌─────▼──────┐
                              │ DB     │  │ Scoring │  │ Strava API │
                              │ Queries│  │ Service │  │ (live)     │
                              └────────┘  └────────┘  └────────────┘
```

### 3.2 Gemini Function Calling (Tool Use) — The Core Pattern

Rather than dumping the entire database into the prompt, we use **Gemini's function calling** feature. The AI decides which tools to call based on the user's question, then synthesizes the results.

This is the key design decision: Gemini acts as an **intelligent query planner**, not a database.

---

## 4. Tools to Expose to Gemini

Each tool is a function the AI can call. The backend executes it and returns results. Gemini then reasons over the data to answer the user's question.

### 4.1 Season & Week Tools

| Tool Name | Parameters | Returns | Purpose |
|-----------|-----------|---------|---------|
| `list_seasons` | none | `[{id, name, start_at, end_at}]` | List all seasons |
| `get_season_weeks` | `season_id` | `[{id, week_name, segment_name, average_grade, required_laps, start_at, end_at, multiplier}]` | Get all weeks in a season with segment details |
| `get_current_season` | none | `{id, name, start_at, end_at}` | Get the currently active season |

### 4.2 Leaderboard & Scoring Tools

| Tool Name | Parameters | Returns | Purpose |
|-----------|-----------|---------|---------|
| `get_week_leaderboard` | `week_id` | `[{rank, name, total_time_seconds, base_points, pr_bonus, participation_bonus, multiplier, total_points, watts, heartrate, activity_date}]` | Full scored leaderboard for a week |
| `get_season_standings` | `season_id` | `[{rank, name, total_points, weeks_completed, polka_dot_wins}]` | Season-level standings |
| `get_week_by_name_and_season` | `week_name, season_name` | `{week_id, week_name, segment, start_at, end_at}` | Fuzzy lookup — "Box Hill in Winter 2026" |

### 4.3 Participant Tools

| Tool Name | Parameters | Returns | Purpose |
|-----------|-----------|---------|---------|
| `list_participants` | none | `[{strava_athlete_id, name, weight, active}]` | List all participants |
| `get_participant_profile` | `athlete_name` | `{name, season_stats[], career_stats}` | Full profile with career stats |
| `get_participant_history` | `athlete_name, season_id?` | `[{week_name, rank, time, points, pr}]` | Week-by-week results for an athlete |

### 4.4 Effort & Performance Tools

| Tool Name | Parameters | Returns | Purpose |
|-----------|-----------|---------|---------|
| `get_effort_details` | `week_id, athlete_name` | `[{lap, elapsed_seconds, average_watts, average_heartrate, max_heartrate, average_cadence, pr_achieved, device_watts}]` | Lap-by-lap effort breakdown |
| `compare_athletes` | `athlete_names[], week_id?` | Per-athlete stats side by side | Head-to-head comparisons |
| `get_watts_per_kg_ranking` | `week_id` | `[{name, avg_watts, weight_kg, watts_per_kg}]` | Watts/kg leaderboard for a week |

### 4.5 Analysis & Trends Tools

| Tool Name | Parameters | Returns | Purpose |
|-----------|-----------|---------|---------|
| `get_improvement_report` | `season_id, last_n_weeks?` | `[{name, time_improvement_pct, points_trend}]` | Who improved most recently |
| `get_segment_records` | `segment_name` | `[{name, best_time, date, season}]` | All-time bests on a segment |
| `get_jersey_winners` | `season_id` | `{yellow: {name, points}, polka_dot: {name, wins}}` | Jersey award winners |

### 4.6 Live Strava Tools (Rate-Limited)

| Tool Name | Parameters | Returns | Purpose |
|-----------|-----------|---------|---------|
| `get_strava_recent_activities` | `athlete_name, days_back?` | `[{name, type, distance, time, date}]` | Recent Strava activities beyond competition |
| `get_strava_athlete_profile` | `athlete_name` | `{city, state, country, ftp, weight}` | Live Strava profile data |

**Guardrails for Strava tools:**
- Only callable if the athlete has a valid stored token
- Rate-limited at the tool level (see Section 8)
- The AI is instructed to prefer local data over Strava calls
- Strava tools clearly marked as "slow, use sparingly" in tool descriptions

---

## 5. Backend Implementation

### 5.1 New Files

```
server/src/
├── services/
│   └── ChatService.ts          # Orchestrator: manages Gemini conversation + tool execution
│   └── ChatToolRunner.ts       # Executes tools (DB queries, Strava calls) 
│   └── ChatToolDefinitions.ts  # Tool schemas in Gemini function-calling format
│   └── ChatContextBuilder.ts   # Builds system prompt with competition context
├── routers/
│   └── chat.ts                 # tRPC router with adminProcedure
```

### 5.2 Dependencies

```bash
cd server && npm install @google/generative-ai
```

The `@google/generative-ai` package is Google's official Node.js SDK for Gemini.

### 5.3 Environment Variables

```env
# .env
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash           # Which model to use
CHAT_RATE_LIMIT_PER_MINUTE=10           # Rate limit per user per minute
CHAT_RATE_LIMIT_PER_DAY=100             # Rate limit per user per day
CHAT_ENABLED=true                        # Feature flag
```

Add to `config.ts`:

```typescript
// AI Chat
geminiApiKey: process.env.GEMINI_API_KEY || undefined,
geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
chatEnabled: process.env.CHAT_ENABLED === 'true',
chatRateLimitPerMinute: parseInt(process.env.CHAT_RATE_LIMIT_PER_MINUTE || '10', 10),
chatRateLimitPerDay: parseInt(process.env.CHAT_RATE_LIMIT_PER_DAY || '100', 10),
```

### 5.4 ChatService.ts — Core Orchestrator

```typescript
// Pseudocode for the main service
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatToolDefinitions } from './ChatToolDefinitions';
import { ChatToolRunner } from './ChatToolRunner';
import { ChatContextBuilder } from './ChatContextBuilder';

export class ChatService {
  private genAI: GoogleGenerativeAI;
  private toolRunner: ChatToolRunner;
  
  constructor(
    private db: BetterSQLite3Database,
    apiKey: string,
    modelName: string
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.toolRunner = new ChatToolRunner(db);
  }

  async chat(
    message: string,
    conversationHistory: Message[],
    userId: string
  ): Promise<ChatResponse> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: ChatContextBuilder.buildSystemPrompt(),
      tools: [{ functionDeclarations: ChatToolDefinitions.getAll() }],
    });

    const chat = model.startChat({
      history: conversationHistory,
    });

    // Send message, handle function calling loop
    let result = await chat.sendMessage(message);
    
    // Function calling loop: Gemini may request tool calls
    while (result.response.functionCalls()?.length) {
      const functionCalls = result.response.functionCalls();
      const toolResults = await Promise.all(
        functionCalls.map(call => this.toolRunner.execute(call.name, call.args))
      );
      
      // Send tool results back to Gemini
      result = await chat.sendMessage(
        toolResults.map((r, i) => ({
          functionResponse: {
            name: functionCalls[i].name,
            response: r
          }
        }))
      );
    }

    return {
      message: result.response.text(),
      toolsUsed: /* track which tools were called */,
    };
  }
}
```

### 5.5 ChatToolRunner.ts — Tool Execution Engine

This is where the actual data fetching happens. Each tool maps to a method that runs DB queries or Strava API calls using existing services.

```typescript
export class ChatToolRunner {
  private scoringService: ScoringService;
  private standingsService: StandingsService;
  private profileService: ProfileService;
  private jerseyService: JerseyService;

  constructor(private db: BetterSQLite3Database) {
    this.scoringService = new ScoringService(db);
    this.standingsService = new StandingsService(db);
    this.profileService = new ProfileService(db);
    this.jerseyService = new JerseyService(db);
  }

  async execute(toolName: string, args: Record<string, any>): Promise<any> {
    switch (toolName) {
      case 'get_week_leaderboard':
        return this.getWeekLeaderboard(args.week_id);
      case 'get_season_standings':
        return this.getSeasonStandings(args.season_id);
      case 'get_watts_per_kg_ranking':
        return this.getWattsPerKgRanking(args.week_id);
      case 'get_strava_recent_activities':
        return this.getStravaRecentActivities(args.athlete_name, args.days_back);
      // ... etc
    }
  }

  // Example: watts/kg computation from stored data
  private async getWattsPerKgRanking(weekId: number) {
    // Query segment_effort.average_watts + activity.athlete_weight
    // Compute watts/kg, sort, return
  }

  // Example: live Strava call
  private async getStravaRecentActivities(athleteName: string, daysBack = 7) {
    const participant = /* find by name */;
    const accessToken = await getValidAccessToken(this.db, stravaClient, participant.strava_athlete_id);
    const after = Math.floor(Date.now() / 1000) - (daysBack * 86400);
    const activities = await stravaClient.listAthleteActivities(accessToken, after, Math.floor(Date.now() / 1000));
    // Return summarized, safe subset of data
  }
}
```

### 5.6 ChatContextBuilder.ts — System Prompt

The system prompt gives Gemini context about what this app is and how to behave:

```typescript
export class ChatContextBuilder {
  static buildSystemPrompt(): string {
    return `You are an AI assistant for the WMV (Western Mass Velo) Cycling Series app.
This is a Zwift-based virtual cycling competition where participants complete weekly hill climbs
and time trials on designated Strava segments.

KEY CONCEPTS:
- Seasons contain multiple weeks. Each week has a designated Strava segment.
- Hill Climb weeks: segment average_grade > 2% (Polka Dot jersey eligible)
- Time Trial weeks: segment average_grade ≤ 2% (Yellow jersey eligible)
- Points: (participants beaten + 1 participation + PR bonus) × week multiplier
- Scores are computed fresh each time, not stored.

RESPONSE GUIDELINES:
- Be concise and data-focused. Use tables for comparisons.
- Format times as MM:SS or HH:MM:SS as appropriate.
- When showing watts/kg, use 2 decimal places.
- Always specify which season/week you're referring to.
- If you can't answer from available data, say so clearly.
- Prefer local database tools over Strava API tools (faster, no rate limits).
- When comparing athletes, be respectful — this is a community competition.
- Never expose raw Strava athlete IDs to users.
- Never reveal internal tool names or system implementation details.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}
`;
  }
}
```

### 5.7 tRPC Router — `chat.ts`

```typescript
import { z } from 'zod';
import { router, adminProcedure } from '../trpc/init';
import { ChatService } from '../services/ChatService';
import { config } from '../config';

const messageSchema = z.object({
  role: z.enum(['user', 'model']),
  parts: z.array(z.object({ text: z.string() })),
});

export const chatRouter = router({
  sendMessage: adminProcedure
    .input(z.object({
      message: z.string().min(1).max(1000),
      history: z.array(messageSchema).max(50).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!config.geminiApiKey) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Chat not configured' });
      }

      const chatService = new ChatService(ctx.orm, config.geminiApiKey, config.geminiModel);
      
      const result = await chatService.chat(
        input.message,
        input.history,
        ctx.userId!
      );

      return {
        response: result.message,
        toolsUsed: result.toolsUsed,
      };
    }),
});
```

Register in `routers/index.ts`:
```typescript
import { chatRouter } from './chat';

export const appRouter = router({
  // ... existing routers
  chat: chatRouter,
});
```

---

## 6. Frontend Implementation

### 6.1 New Files

```
src/
├── components/
│   └── ChatPanel.tsx         # Main chat UI component
│   └── ChatPanel.css         # Styles
│   └── ChatMessage.tsx       # Individual message bubble
```

### 6.2 Route & Navigation

**Add route in `App.tsx`:**
```tsx
<Route path="/chat" element={isAdmin ? <ChatPanel /> : <Navigate to="/leaderboard" replace />} />
```

**Add nav item in `NavBar.tsx`** (inside the `{isAdmin && ( ... )}` block, alongside existing admin menu items):

```tsx
{isAdmin && (
  <>
    {/* ... existing admin menu items ... */}
    <NavLink 
      to="/chat" 
      className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
      onClick={() => setIsMenuOpen(false)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      AI Chat
    </NavLink>
  </>
)}
```

This leverages the exact same `isAdmin` guard already used for "Manage Competition", "Manage Seasons", etc.

### 6.3 ChatPanel.tsx — UI Component

Key features:
- Text input with send button
- Scrollable message list (user messages right-aligned, AI left-aligned)
- Loading indicator while AI is responding
- Conversation history maintained in React state (ephemeral)
- Shows which tools were used (optional, debug mode for admins)
- Suggested starter questions ("Who's leading this season?", "Show me last week's results")
- Mobile-responsive design consistent with existing app

```tsx
// Pseudocode structure
const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, 
        { role: 'model', text: data.response }
      ]);
    }
  });

  const handleSend = () => {
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    sendMessage.mutate({
      message: input,
      history: messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      })),
    });
    setInput('');
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>
      <div className="chat-input-area">
        <textarea value={input} onChange={e => setInput(e.target.value)} />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};
```

### 6.4 ViewMode Update

Add `'chat'` to the `ViewMode` type in `App.tsx`:

```typescript
type ViewMode = 'leaderboard' | 'admin' | 'participants' | 'segments' | 'seasons' | 'webhooks' | 'about' | 'profile' | 'chat';
```

And `getPageTitle`:
```typescript
case 'chat': return 'AI Chat';
```

---

## 7. Admin-Only Access Control

### 7.1 Phase 1 — Admin Only (Current Plan)

Access is restricted using the **exact same pattern** as existing admin features:

**Backend:** The `chatRouter` uses `adminProcedure` (from `server/src/trpc/init.ts`), which:
1. Checks `ctx.userId` exists (user is authenticated via Strava session)
2. Checks `ctx.isAdmin` is true (athlete ID is in `ADMIN_ATHLETE_IDS` env var)
3. Throws `UNAUTHORIZED` TRPCError if either check fails

**Frontend:** The chat nav item and route are guarded by `isAdmin` prop (same as "Manage Competition" etc.), which comes from the `participant.getAuthStatus` query that checks `config.adminAthleteIds`.

**Currently configured admins:** `ADMIN_ATHLETE_IDS=366880,16044526,15179953` (3 admins)

### 7.2 Phase 2 — Broader Access (Future)

When ready to open chat to all authenticated users:

1. **Create a new procedure** — `authenticatedProcedure` (between `publicProcedure` and `adminProcedure`):
   ```typescript
   const isAuthenticated = middleware(async ({ ctx, next }) => {
     if (!ctx.userId) {
       throw new TRPCError({ code: 'UNAUTHORIZED' });
     }
     return next({ ctx: { session: ctx.session, userId: ctx.userId } });
   });
   
   export const authenticatedProcedure = publicProcedure.use(isAuthenticated);
   ```

2. **Switch `chatRouter`** from `adminProcedure` to `authenticatedProcedure`
3. **Move nav item** from the admin section to the general authenticated section in NavBar
4. **Apply per-user rate limiting** (see Section 8)

---

## 8. Rate Limiting

### 8.1 Gemini API Rate Limiting

**In-memory rate limiter** (sufficient for single-instance SQLite app):

```typescript
// server/src/services/ChatRateLimiter.ts
export class ChatRateLimiter {
  private minuteBuckets: Map<string, { count: number; resetAt: number }> = new Map();
  private dayBuckets: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(
    private perMinuteLimit: number = 10,
    private perDayLimit: number = 100
  ) {}

  check(userId: string): { allowed: boolean; retryAfterMs?: number } {
    // Check minute bucket
    // Check day bucket
    // Return allowed/denied
  }

  consume(userId: string): void {
    // Increment counters
  }
}
```

**Rate limit strategy by phase:**

| Phase | Per User Per Minute | Per User Per Day | Total App Per Day |
|-------|-------------------|-----------------|-------------------|
| Admin only (Phase 1) | 10 | 200 | 1000 |
| All users (Phase 2) | 5 | 50 | 2000 |

### 8.2 Strava API Rate Limiting

Strava imposes app-wide limits: **100 requests per 15 minutes, 1000 per day**.

The chat Strava tools need a **separate budget** from the core competition fetch operations:

```typescript
// Reserve portion of Strava rate limit for chat
const STRAVA_CHAT_BUDGET_PER_15MIN = 20;  // Out of 100 total
const STRAVA_CHAT_BUDGET_PER_DAY = 100;    // Out of 1000 total
```

The `ChatToolRunner` should:
1. Track Strava API calls made by chat separately
2. Reject Strava tool calls if budget exceeded
3. Tell Gemini: "Strava API rate limit reached, answer from local data only"
4. Log Strava usage for monitoring

### 8.3 Cost Monitoring

Gemini 2.0 Flash pricing (approximate, as of early 2026):
- Input: ~$0.10 per 1M tokens
- Output: ~$0.40 per 1M tokens

A typical chat exchange: ~1K input tokens (system prompt + history + tool results), ~200 output tokens.
**Estimated cost per message: ~$0.0002** (negligible for admin-only usage).

For Phase 2 (all users), monitor via:
- Log total tokens used per day
- Set a monthly cost budget alert
- Consider adding a `CHAT_MONTHLY_BUDGET` env var

---

## 9. Implementation Phases

### Phase 1: MVP (Admin Chat with Local Data) — ~3-4 days

**Backend tasks:**
1. Install `@google/generative-ai` package
2. Add config entries (`GEMINI_API_KEY`, `GEMINI_MODEL`, `CHAT_ENABLED`)
3. Implement `ChatToolDefinitions.ts` (define all local-data tools in Gemini function-calling format)
4. Implement `ChatToolRunner.ts` (wire tools to existing services + custom DB queries)
5. Implement `ChatContextBuilder.ts` (system prompt)
6. Implement `ChatService.ts` (Gemini conversation + function calling loop)
7. Create `ChatRateLimiter.ts` (in-memory)
8. Create `chatRouter.ts` (tRPC router with `adminProcedure`)
9. Register chat router in `routers/index.ts`
10. Write unit tests for tool runner (using existing `setupTestDb` pattern)

**Frontend tasks:**
1. Create `ChatPanel.tsx` + `ChatPanel.css`
2. Create `ChatMessage.tsx` (message bubble component)
3. Add `/chat` route to `App.tsx` (admin-guarded)
4. Add "AI Chat" nav item to `NavBar.tsx` (admin section)
5. Add `'chat'` to `ViewMode` type and `getPageTitle`

**Tools implemented in Phase 1:**
- `list_seasons`
- `get_current_season`
- `get_season_weeks`
- `get_week_leaderboard`
- `get_season_standings`
- `get_week_by_name_and_season`
- `list_participants`
- `get_participant_profile`
- `get_participant_history`
- `get_effort_details`
- `get_watts_per_kg_ranking`
- `get_jersey_winners`
- `get_improvement_report`
- `compare_athletes`

### Phase 2: Live Strava Integration — ~1-2 days

1. Add Strava tool definitions (`get_strava_recent_activities`, `get_strava_athlete_profile`)
2. Implement Strava tool execution in `ChatToolRunner` using `tokenManager.getValidAccessToken()`
3. Add Strava-specific rate limiting budget
4. Update system prompt to guide AI on when to use Strava vs. local data
5. Add error handling for token issues (athlete not connected, token expired)

### Phase 3: Polish & Broader Access — ~1-2 days

1. Create `authenticatedProcedure` middleware
2. Switch chat router to `authenticatedProcedure`
3. Move nav item to general section
4. Apply per-user rate limiting  
5. Add usage logging/monitoring
6. Add suggested starter questions in UI
7. Add "thinking..." indicators showing which tools are being called
8. Mobile-responsive chat layout optimization

### Phase 4: Advanced Features (Future)

- **Streaming responses**: Use Gemini's streaming API for progressive rendering  
- **Data visualization**: Return chart data that the frontend renders (e.g., performance trend chart)
- **Conversation memory**: Optional persistence to database (new `chat_message` table)
- **Multi-turn context caching**: Use Gemini's context caching for long conversations
- **Segment records tool**: All-time bests across seasons for a given segment
- **"What if" simulations**: "What would standings look like if Tim hadn't participated?"

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Prompt injection | System prompt hardcoded server-side; user messages are just text in the `user` role. Gemini function calling has a structured interface — users cannot define new tools. |
| Data exfiltration | Tool results are filtered to safe fields. No raw tokens, no database IDs exposed. Strava athlete IDs not shown to users. |
| API key exposure | `GEMINI_API_KEY` in server-side env vars only, never sent to frontend. |
| Rate abuse | In-memory rate limiter per user. Admin-only reduces exposure. |
| Inappropriate content | Gemini has built-in safety filters. System prompt constrains responses to cycling data. |
| Strava token misuse | Strava calls use existing `getValidAccessToken()` pattern. Each athlete's data accessed via their own token. |
| Cost runaway | Rate limits cap daily usage. Token usage logged for monitoring. |

---

## 11. Testing Strategy

### Unit Tests (Jest, in-memory SQLite)

- `ChatToolRunner.test.ts`: Test each tool returns correct data
  - Uses existing `setupTestDb` pattern with test data
  - Verify watts/kg calculation, improvement reports, fuzzy name matching
- `ChatRateLimiter.test.ts`: Test rate limiting logic
- `ChatContextBuilder.test.ts`: Test system prompt generation

### Integration Tests

- `ChatService.test.ts`: Mock Gemini API, verify function calling loop
  - Test: simple question → no tool calls → text response
  - Test: data question → tool calls → synthesized response
  - Test: multi-tool question → parallel tool calls → combined response
  - Test: Strava tool → token fetch → API call → response

### Manual Testing

- Test with real Gemini API key against dev database
- Verify natural language understanding for competition-specific queries
- Test edge cases: ambiguous athlete names, empty results, future weeks

### E2E Tests (Playwright)

- Verify chat page only appears for admin users
- Verify non-admin users get redirected
- Basic chat flow: type message → see response (mock backend)

---

## 12. File Summary — All Changes

| File | Action | Description |
|------|--------|-------------|
| `server/package.json` | Modify | Add `@google/generative-ai` dependency |
| `server/src/config.ts` | Modify | Add Gemini config entries |
| `server/src/services/ChatService.ts` | **New** | Core Gemini orchestrator |
| `server/src/services/ChatToolRunner.ts` | **New** | Tool execution engine |
| `server/src/services/ChatToolDefinitions.ts` | **New** | Gemini function calling schemas |
| `server/src/services/ChatContextBuilder.ts` | **New** | System prompt builder |
| `server/src/services/ChatRateLimiter.ts` | **New** | In-memory rate limiter |
| `server/src/routers/chat.ts` | **New** | tRPC router (adminProcedure) |
| `server/src/routers/index.ts` | Modify | Register chat router |
| `server/src/trpc/init.ts` | Modify (Phase 2) | Add authenticatedProcedure |
| `src/components/ChatPanel.tsx` | **New** | Chat UI component |
| `src/components/ChatPanel.css` | **New** | Chat styles |
| `src/components/ChatMessage.tsx` | **New** | Message bubble component |
| `src/App.tsx` | Modify | Add /chat route + ViewMode |
| `src/components/NavBar.tsx` | Modify | Add AI Chat menu item |
| `.env` | Modify | Add GEMINI_API_KEY etc. |
| `server/src/__tests__/ChatToolRunner.test.ts` | **New** | Tool runner tests |
| `server/src/__tests__/ChatRateLimiter.test.ts` | **New** | Rate limiter tests |

---

## 13. Example Interactions

### Simple question (no tools needed)
> **User:** What is the WMV Cycling Series?  
> **AI:** The WMV Cycling Series is a weekly virtual cycling competition organized by Western Mass Velo. Participants complete designated Strava segments on Zwift, racing hill climbs and time trials. Points are awarded based on relative performance, with jerseys for season champions.

### Database query (tools: get_current_season → get_season_standings)
> **User:** Who's leading the current season?  
> **AI:** In the **Winter 2026** season standings:
> | Rank | Name | Points | Weeks |
> |------|------|--------|-------|
> | 1 | Tim Downey | 42 | 8 |
> | 2 | Will Downey | 38 | 8 |
> | 3 | Steve Wysk | 35 | 7 |

### Performance analysis (tools: get_week_by_name_and_season → get_watts_per_kg_ranking)
> **User:** Who had the highest watts/kg on the last Box Hill climb?  
> **AI:** For the **Box Hill KOM** week (Winter 2026), watts/kg rankings:
> | Rank | Name | Avg Watts | Weight (kg) | W/kg |
> |------|------|-----------|------------|------|
> | 1 | Will Downey | 312 | 67.6 | 4.62 |
> | 2 | Ava Downey | 243 | 54.9 | 4.43 |
> | 3 | Tim Downey | 341 | 86.2 | 3.96 |

### Live Strava fetch (tools: get_strava_recent_activities)
> **User:** What other rides did Steve do this past week?  
> **AI:** Steve Wysk's recent Strava activities (last 7 days):
> - **Tuesday**: Zwift - Volcano Flat (45 min, 28.3 km)
> - **Thursday**: Zwift - Mountain Route (1h 12min, 35.1 km)
> - **Saturday**: Outdoor ride - Northampton Loop (2h 05min, 62.4 km)

---

## 14. Open Questions & Decisions

1. **Fuzzy name matching**: Should `get_participant_profile("Tim")` return all Tims, or ask for clarification? → **Recommendation:** Return all matches, let Gemini disambiguate with context.

Answer -- Use fuzzy matching for things like participant names, segment names, etc.  If necessary, use something like the fuse library to help.

2. **Cross-season comparisons**: "How did Tim do on Alpe du Zwift compared to last season?" requires running scoring for both seasons. → **Recommendation:** Support via `get_participant_history` with optional season filter.

Answer -- Yes, accept recommendation.

3. **Real-time notifications**: Should the chat show "New results available!" when webhooks process? → **Recommendation:** Phase 4. Not needed for MVP.

Answer -- Not needed at this time.

4. **Markdown rendering**: Gemini responses include markdown (tables, bold). → **Recommendation:** Use a lightweight markdown renderer (e.g., `react-markdown`) in `ChatMessage.tsx`.

Answer - Yes, lightweight markdown is excellent.

5. **Max conversation length**: Gemini 2.0 Flash has a 1M token context window. With 50-message history cap, this is well within limits. → **Recommendation:** Keep 50-message cap, clear history button.

Yes, accept recommendation.