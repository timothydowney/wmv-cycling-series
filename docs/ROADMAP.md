# Roadmap & Future Features

**Last Updated:** November 22, 2025  
**Current Status:** Feature-complete and production-ready. Code quality improvements in progress (Priority 4-5: Database types, UI testing). Below are enhancement ideas for future seasons.

---

## Priority: High (Season 2+)

### 1. Season Archival / Data Retention

**Description:** Archive final season standings as immutable snapshots when a season ends.

**Why:** 
- Preserve historical records ("We won 2025 Fall")
- Optional: Reclaim storage by deleting raw activities
- Lock final scores (immutable)

**Implementation Notes:**
- New `season_snapshots` table
- Trigger on season deactivation
- See: `docs/SCORING_ARCHITECTURE.md` - "Season Archival (Future Feature)"
- Privacy compliant (no sensitive data in snapshots)

**Effort:** 2-3 hours (design complete, ready to implement)  
**Breaking Changes:** None

---

### 2. Strava Webhook Integration

**Description:** Replace manual "Fetch Results" button with real-time webhooks from Strava.

**Current State:** Admin manually clicks "Fetch Results" after event day  
**Future State:** New activities auto-detected and leaderboard updates immediately

**Why:**
- No manual step for admins
- Real-time results
- Faster user experience

**Implementation Notes:**
- Strava provides webhook events when activities are created
- Store webhook subscription in database
- Verify webhook signatures (security)
- Handle retries and deduplication

**Effort:** 4-6 hours  
**Breaking Changes:** None (additive)  
**Strava API:** Standard webhooks (no special approval needed)

---

### 3. Email Notifications

**Description:** Send weekly notifications to participants (optional opt-in).

**Current State:** Users must visit the website to see results  
**Future State:** "You finished 2nd place! 3 points" via email

**Why:**
- Engagement
- No need to check website
- Celebratory moment

**Implementation Notes:**
- Use email service (SendGrid, Mailgun, or simple SMTP)
- Opt-in only (store preference in database)
- Send after results are fetched
- Template: Final leaderboard + season standings

**Effort:** 3-4 hours  
**Breaking Changes:** None (opt-in)  
**Cost:** ~$10-20/month for email service (optional)

---

### 4. Admin UI for Week Creation

**Description:** Web form instead of curl commands for creating weeks.

**Current State:** `POST /admin/weeks` via curl or API  
**Future State:** "Create Week" button in admin panel

**Why:**
- Better UX for non-technical admins
- Less error-prone
- Segment search built-in

**Implementation Notes:**
- React component in admin panel
- Form validation on frontend
- POST to existing `/admin/weeks` endpoint
- Show segment search with autocomplete

**Effort:** 2-3 hours  
**Breaking Changes:** None (UI only)

---

## Priority: Medium (Season 3+)

### 5. Activity Audit & Manual Overrides

**Description:** Admin can view activity details and manually adjust/exclude activities if needed.

**Why:**
- User submits wrong activity
- Activity fetched but shouldn't count (format error, etc.)
- Admin can correct without recalculating all scores

**Implementation Notes:**
- Activity detail view with segment efforts
- Button to "exclude activity" from leaderboard
- Shows what score would be without it
- Audit log of all changes

**Effort:** 3-4 hours  
**Breaking Changes:** None

---

### 6. Leaderboard Filters & Search

**Description:** Filter leaderboards by week, season, participant name.

**Why:**
- "Show me all my results"
- "Compare against specific competitor"

**Implementation Notes:**
- Frontend component with filters
- Query existing leaderboard endpoints with parameters
- Return filtered results

**Effort:** 2-3 hours  
**Breaking Changes:** None (additive)

---

### 7. Activity Description Enhancement

**Description:** Show more details on leaderboards (route, weather, etc. from Strava).

**Why:**
- Context for results ("Icy conditions that day")
- More engaging

**Implementation Notes:**
- Store additional Strava fields when fetching activities
- Display on leaderboard

**Effort:** 2 hours  
**Breaking Changes:** None

---

## Priority: Low (Future)

### 8. Mobile App

**Description:** Native iOS/Android app for viewing leaderboards.

**Why:**
- Better mobile UX (current web is mobile-friendly but not native)

**Implementation Notes:**
- Use existing API endpoints
- React Native or Flutter

**Effort:** 20-40 hours (not starting soon)  
**Breaking Changes:** None

---

### 9. Analytics Dashboard

**Description:** Admin view of participation trends, speed trends, etc.

**Why:**
- See who's improving
- Engagement metrics
- Fun statistics

**Implementation Notes:**
- Query activities/results
- Chart library (Chart.js, Recharts)

**Effort:** 4-6 hours  
**Breaking Changes:** None

---

### 10. Integration with Strava Clubs

**Description:** List WMV as a "club" on Strava, auto-sync members.

**Why:**
- Easier onboarding
- Strava integration point

**Implementation Notes:**
- Strava Club API
- Auto-populate participants from club members
- Still require OAuth for each member

**Effort:** 3-4 hours  
**Breaking Changes:** None  
**Strava API:** Special review may be required

---

## Maintenance & Stability

### Code Quality (In Progress)

#### Completed ✅
- [x] **Logger Types Extraction** - Created `server/src/types/Logger.ts` with structured logging types
  - LogLevel enum, LogEntry interface, StructuredLogger class
  - Dependency-injection-based callbacks for testability
  - Used in BatchFetchService, activityProcessor

- [x] **Markdown Editor Hook** - Created `src/hooks/useMarkdownEditor.ts`
  - Extracted 170+ lines from NotesEditor.tsx component
  - Reusable markdown parsing/serialization logic
  - TipTap editor integration with mode switching
  - NotesEditor.tsx reduced from 170+ to 90 lines

- [x] **SSE Parser Utility** - Created `src/utils/sseParser.ts`
  - Type-safe Server-Sent Events parser with generics
  - SSEParser class, parseSSE helper, waitForSSEEvent, validateSSEData
  - Refactored api.ts fetchWeekResults() from 80+ lines to 35 lines
  - Full type safety, proper error handling

- [x] **Database Row Types** - Created `server/src/types/database.ts`
  - 10 database row types: ParticipantRow, SegmentRow, SeasonRow, WeekRow, ActivityRow, SegmentEffortRow, ResultRow, ParticipantTokenRow, DeletionRequestRow, WebhookEventRow
  - Insert types for parameterized queries
  - Type guard functions for runtime validation
  - Replaced 15+ `as any` patterns with proper types
  - Zero TypeScript errors, all 342 tests passing

#### In Progress 🔄
- [ ] **Activity/Segment Effort Type Safety** - Complex architectural refactoring
  - Issue: ActivityRow ≠ ActivityResponse (API response types vs database row types)
  - Issue: SegmentEffortRow ≠ SegmentEffortData (storage types vs API types)
  - Location: `server/src/services/BatchFetchService.ts:119`, `server/src/webhooks/processor.ts:239`
  - Impact: Currently masked with `as any` (4 remaining patterns)
  - Effort: 3-4 hours (requires careful refactoring of activity processing pipeline)
  - Note: These are legitimate architectural issues where API response transformation to database format needs explicit typing

#### Planned 📋
- [ ] **UI Component Tests** - Frontend unit tests with Vitest
  - Components: FetchProgressPanel.tsx, NotesEditor.tsx
  - Mock: SSE responses, markdown editor behavior
  - Target: >80% component coverage
  - Effort: 4-6 hours
  - Note: Backend tests at 62.53% coverage, frontend tests needed for feature confidence

- [ ] **Increase overall test coverage from 62.53% to 70%+**
  - Focus: Service layer, routes, edge cases
  - Tools: Jest (backend), Vitest (frontend)

#### Future
- [ ] Add E2E tests with Cypress/Playwright
- [ ] Performance testing (load test with 500+ participants)

### Infrastructure
- [ ] Database backups verification (monthly test)
- [ ] Disaster recovery plan documented
- [ ] Uptime monitoring (Uptime Robot)
- [ ] Error tracking (Sentry)

### Documentation
- [ ] Video tutorial: "Admin creates a week"
- [ ] FAQ page for participants
- [ ] Troubleshooting guide

---

## Known Limitations

### Current
- **SQLite only:** Scales to ~100 participants. Migrate to PostgreSQL if bigger.
- **Manual admin trigger:** Results require "Fetch Results" button click
- **No webhooks:** Can't detect new activities in real-time
- **Email:** No notification system

### Acceptable at Current Scale
- No caching layer needed (queries are fast)
- No CDN needed (traffic is low)
- No rate limiting issues (Strava API limits not hit)

---

## Scaling Milestones

| Participants | Recommendation | Action |
|---|---|---|
| <100 | ✅ Current setup | No changes needed |
| 100-500 | Webhooks + archives | Add webhooks, start archiving seasons |
| 500-1000 | PostgreSQL migration | Switch from SQLite to PostgreSQL |
| 1000+ | Read replica + cache | Add Redis, read replicas |

**We are currently at <100. Enjoy the simplicity!**

---

## How to Contribute

1. **Pick a roadmap item**
2. **Create a feature branch:** `git checkout -b feature/webhooks`
3. **Implement:** Follow coding standards in `.github/copilot-instructions.md`
4. **Test:** Add tests, run `npm run check`
5. **PR:** Submit PR with description linking to roadmap item
6. **Review:** Get approval, merge to main

---

## References

- **Feature Status:** See sections above
- **Current Architecture:** `docs/ARCHITECTURE.md`
- **API Reference:** `docs/API.md`
- **Deployment:** `docs/DEPLOYMENT.md`

---

**Questions?** See the comprehensive docs in `docs/README.md` or contact the maintainers.
