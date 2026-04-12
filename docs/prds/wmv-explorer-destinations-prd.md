# Product Requirements Document (PRD)

## WMV Explorer Destinations

| Field | Value |
| --- | --- |
| Product Name | WMV Explorer Destinations |
| Version | 0.1 |
| Author | GitHub Copilot |
| Date | 2026-04-12 |
| Status | Draft |

## 1. Executive Summary

WMV Explorer Destinations is a new offseason participation feature for the WMV Cycling Series app. Instead of rewarding speed or rank, it gives athletes a weekly set of admin-curated Strava segment destinations to visit. Each matched destination counts as one completion point for that week, and the primary experience is personal progress: how many destinations an athlete has completed, which ones remain, and whether they finished the full weekly set.

The feature is designed to work for both outdoor and virtual riding, as long as the destination is represented by a Strava segment. This makes the experience more inclusive for riders doing real-world routes, Zwift routes, or a mix of both. The product also stores Explorer results across weeks so WMV can later expand into season-wide Explorer campaigns and broader participation tracking.

## 2. Problem Statement

The current WMV Cycling Series product is centered on weekly segment competition, time-based scoring, and season standings. That model works well for time trials and hill climbs, but it does not serve riders who want a lower-pressure, more exploratory way to participate during the offseason.

Existing gaps include:

- Participation is currently framed mainly as competition rather than exploration.
- There is no product area for weekly destination-based riding goals.
- There is no persistent record of exploration-style accomplishments across weeks.
- The current UI does not support a simple personal-progress model such as checklist completion or progress bars.
- The current webhook processor is already serving multiple purposes and needs a cleaner extension path before adding Explorer matching.

WMV Explorer Destinations addresses these problems by adding a progress-first weekly experience that reuses Strava activity data and admin curation without forcing riders into a race-style leaderboard.

## 3. Goals & Objectives

| Goal | Description | Success Signal |
| --- | --- | --- |
| Inclusive offseason participation | Give riders a way to participate without needing to compete on speed | Riders can engage through weekly destination completion rather than race ranking |
| Weekly motivation | Provide a clear set of weekly riding goals | Athletes can see a weekly progress bar and destination checklist |
| Low admin friction | Let admins create a weekly Explorer challenge from Strava segments | Admin can create an Explorer week and configure destinations in one workflow |
| Reuse current WMV systems | Build on existing Strava auth and ingestion patterns | No manual athlete submissions required for normal use |
| Preserve future flexibility | Store Explorer results in a way that supports season-wide Explorer later | Weekly completion history is queryable across multiple weeks |
| Avoid regression in competition features | Add Explorer without breaking current leaderboard and scoring behavior | Current competition routes and scoring remain unchanged |

## 4. Target Audience

| Audience | Description | Primary Need |
| --- | --- | --- |
| Existing WMV athlete | Club rider already using the app for seasonal competition | A fun, low-pressure weekly riding goal |
| Casual or exploratory rider | Rider less interested in racing but motivated by destinations and completion | A checklist-style challenge rather than a ranking system |
| Indoor or hybrid rider | Athlete who rides on Zwift and outdoors | Weekly destinations that can be either virtual or real-world Strava segments |
| Club admin | Person organizing offseason engagement | A simple workflow to define weekly destinations and monitor completions |

## 5. User Stories

### 5.1 Athlete Experience

| ID | User Story | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| US-01 | As an athlete, I want to see the active Explorer week so I know what destinations are available now | Must | Active Explorer week is clearly visible in the Challenges hub |
| US-02 | As an athlete, I want to see the weekly destination list so I know what segments count | Must | Destination list shows all configured segments for the week |
| US-03 | As an athlete, I want to see my Explorer progress as a progress bar so I can quickly tell how far along I am | Must | Progress bar shows completed destinations versus total destinations |
| US-04 | As an athlete, I want a checklist of completed and remaining destinations so I can track what I still need | Must | Each destination shows complete or incomplete state for the logged-in athlete |
| US-05 | As an athlete, I want each matched destination to count once for the week so the rules are easy to understand | Must | Repeated visits to the same destination in the same week do not increase progress |
| US-06 | As an athlete, I want virtual and outdoor Strava segments to count equally as destinations so the feature feels inclusive | Must | Eligibility depends on matching configured Strava segments, not whether a ride is virtual or outdoor |
| US-07 | As an athlete, I want to know if I completed all destinations for the week so I can celebrate finishing the set | Must | Full completion state is visible when all destinations are matched |

### 5.2 Club Visibility

| ID | User Story | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| US-08 | As a club member, I want to know whether anyone completed all destinations this week so the feature feels communal | Must | Weekly view includes a completers summary showing all athlete names who completed the full set |
| US-09 | As a club member, I do not want the Explorer hub to feel like another race leaderboard | Must | Weekly view emphasizes progress and completion, not rank ordering |

### 5.3 Admin Experience

| ID | User Story | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| US-10 | As an admin, I want to create a dedicated Explorer week so the feature can run independently from race weeks | Must | Admin can create Explorer weeks with their own date range |
| US-11 | As an admin, I want to add destinations from Strava URLs so setup matches the regular admin panel workflow | Must | Admin can paste one Strava segment URL at a time and the system extracts the segment ID |
| US-12 | As an admin, I want to add labels to destinations so the weekly challenge is presented clearly | Must | Destinations support optional labels in addition to the underlying segment metadata |
| US-13 | As an admin, I want to reorder destinations so the weekly challenge is presented clearly | Should | Destinations support display order |
| US-14 | As an admin, I want to refresh Explorer matching so I can recover missed or late-connected activities | Must | Admin can trigger a reprocess path for Explorer data |
| US-15 | As an admin, I want Explorer setup to be separate from race week setup so the two products do not get mixed together | Must | Explorer management uses its own admin surface or clearly separated section |
| US-16 | As an admin, I want Explorer weeks to require at least one destination before activation so athletes never see an empty challenge | Must | Explorer week cannot be activated without at least one configured destination |

## 6. MoSCoW Prioritization

### Must Have (MVP)

| Item | User Stories | Rationale |
| --- | --- | --- |
| Separate Challenges hub | US-01, US-10 | Explorer must feel distinct from race competition |
| Active Explorer week view | US-01, US-02 | Core weekly experience |
| Progress bar + checklist UX | US-03, US-04 | Primary interaction model |
| One point per matched destination | US-05 | Simple, explainable rule set |
| Virtual and outdoor segment support | US-06 | Inclusion requirement |
| Weekly completion state | US-07 | Key motivator for the feature |
| Completers summary with all athlete names | US-08 | Light communal visibility without ranking |
| Separate Explorer week admin flow | US-10, US-15 | Keeps data model and UI boundaries clear |
| Strava URL-based destination setup | US-11 | Matches existing admin workflow |
| Destination labels | US-12 | Needed for flexible curation and presentation |
| Activation requires at least one destination | US-16 | Prevents empty Explorer weeks from going live |
| Refresh or backfill action | US-14 | Operational recovery and late joins |
| Persistent Explorer history across weeks | — | Required for future season-wide Explorer support |
| Delegated webhook ingestion path | — | Required to add Explorer without further overloading the webhook processor |

### Should Have (Enhanced Experience)

| Item | User Stories | Rationale |
| --- | --- | --- |
| Destination ordering | US-13 | Better weekly storytelling |
| Cached destination names | — | Better display stability and admin confidence |
| Explorer-specific empty states and help text | — | Clarifies how the feature works for first-time users |
| Regular athlete profile summary | — | Deferred until after the core hub and admin flow are stable |

### Could Have (Delight)

| Item | User Stories | Rationale |
| --- | --- | --- |
| Destination categories such as scenic, climb, or event | — | Adds editorial character to weekly Explorer sets |
| Celebration treatment on full completion | US-07 | Reinforces motivation without adding competition |
| Destination category chips or themed labels | US-12 | Adds editorial polish without changing core rules |

### Won't Have (v1.0 — Future Consideration)

| Item | Rationale |
| --- | --- |
| Rank-ordered Explorer leaderboard | Explorer is progress-first in v1 |
| Bonus scoring beyond one point per destination | Keep the rules simple first |
| Season-wide Explorer UI | Depends on weekly history first |
| Shared-segment mini-races | Separate future feature |
| Badge system | Defer until core Explorer behavior is validated |
| Out-of-process worker or CLI handoff for webhooks | In-process delegated handlers are sufficient for v1 |

## 7. UI/UX Specifications

### 7.1 Layout

The Explorer hub should present one weekly challenge at a time, with a progress-first layout:

- Header area with Explorer week title, date range, and short rules summary.
- Progress section with a visible progress bar showing completed destinations versus total destinations.
- Destination checklist showing all weekly destinations with completed or remaining state for the current athlete.
- Weekly completion summary showing all athletes who completed the full set.
- Lightweight empty or disconnected states when the athlete has no data yet.

### 7.2 UX Principles

| Principle | Description |
| --- | --- |
| Progress over ranking | The page should feel like a challenge checklist, not a leaderboard |
| Clear weekly framing | Athletes should immediately understand what counts this week |
| Inclusive destination model | Virtual and outdoor destinations should be presented as equally valid |
| Low cognitive load | Rules should be understandable in seconds |
| Additive navigation | Explorer should feel like a new section, not a replacement for competition views |

### 7.3 Responsive Behavior

| Breakpoint | Behavior |
| --- | --- |
| Desktop | Progress summary and checklist visible without excessive scrolling |
| Tablet | Checklist remains primary content; summary compresses gracefully |
| Mobile | Progress bar, checklist, and completers summary stack cleanly |

## 8. Non-Functional Requirements

### 8.1 Performance

| Requirement | Target | Validation |
| --- | --- | --- |
| Explorer hub load | Comparable to other existing app views | Manual verification and E2E timing sanity check |
| Matching idempotency | Reprocessing must not create duplicate destination matches | Automated backend tests |
| Refresh behavior | Manual refresh path must be safe to rerun | Automated backend tests |

### 8.2 Data Integrity

| Requirement | Target | Validation |
| --- | --- | --- |
| Durable weekly history | Explorer progress remains queryable after the week ends | Automated integration tests |
| Correct weekly boundaries | Only activities inside the Explorer week count | Backend tests for start and end edge cases |
| One completion per destination per athlete per week | Multiple visits do not overcount | Backend tests |

### 8.3 Accessibility

| Requirement | Target | Validation |
| --- | --- | --- |
| Progress visibility | Completion state is understandable without color alone | Manual QA |
| Checklist semantics | Destination completion is screen-reader friendly | Accessibility review |
| Keyboard navigation | Core Explorer hub interactions are keyboard accessible | Manual QA |

### 8.4 Compatibility

| Requirement | Target | Validation |
| --- | --- | --- |
| Existing WMV app routes | Explorer must coexist with current leaderboard and admin flows | Regression testing |
| Virtual and outdoor segment ingestion | Both segment types are eligible when configured | Backend matching tests |

## 9. Risks & Mitigations

| Risk | Impact | Severity | Mitigation |
| --- | --- | --- | --- |
| Webhook processor complexity grows further | Harder to add Explorer safely | High | Refactor to delegated in-process handlers before adding Explorer-specific logic |
| Strava URLs may be pasted incorrectly or parse to invalid segments | Broken destination configuration | Medium | Validate pasted URLs, extract segment IDs safely, and cache segment metadata where possible |
| Confusion between Explorer weeks and race weeks | Users or admins may mix the two concepts | Medium | Use distinct naming, routes, and admin sections |
| Missing activity matches for late connections or failures | Athlete progress appears incomplete | Medium | Provide explicit refresh or backfill actions |
| Explorer drifts toward competition UX | Reduces inclusiveness and changes product intent | Medium | Avoid rank ordering and center progress/checklist UX |

## 10. Success Criteria

The v1 release is successful if:

1. Admins can create an Explorer week and assign Strava segment destinations.
2. Explorer weeks require at least one destination before they can be activated.
3. Athletes can see a weekly progress bar and destination checklist in the Challenges hub.
4. Each matched destination counts once per athlete per week.
5. Virtual and outdoor segment destinations both work when configured.
6. The hub includes a completers summary showing all completer names without presenting a rank-ordered leaderboard.
7. Explorer history persists across weeks and can support future season-wide aggregation.
8. Existing competition features continue to behave correctly.

## 11. Future Considerations (Post v1.0)

| Future Item | Priority | Notes |
| --- | --- | --- |
| Season-wide Explorer rollups | Medium | Enabled by stored weekly history |
| Explorer badges and streaks | Medium | Depends on stable weekly participation data |
| Themed destination campaigns | Medium | Adds editorial depth to weekly challenges |
| Shared-segment mini-races | High | Requires broader segment aggregation strategy |
| Destination search and richer admin tools | Medium | Improves authoring workflow after v1 |

## 12. Technical Specification

The technical specification for Explorer Destinations is documented in [wmv-explorer-destinations-tech-spec.md](./wmv-explorer-destinations-tech-spec.md), which defines the implementation architecture, schema direction, ingestion pattern, and test strategy.

## 13. Success of Implementation

### 13.1 Definition of Done

| Area | Definition | Validation |
| --- | --- | --- |
| Feature completeness | All Must Have PRD items are implemented and functional | Manual QA plus automated tests |
| Architecture compliance | Explorer uses delegated webhook ingestion and separate Explorer data storage | Code review and backend tests |
| Data integrity | Explorer progress is stored correctly across weeks without duplicate counting | Integration tests |
| UX compliance | Weekly view uses progress bar, checklist, and completers summary without rank ordering | Product QA |
| Regression safety | Existing race leaderboard and admin flows continue to work | Regression suite |

### 13.2 Launch Checklist

- Explorer week creation works in admin UI.
- Destination setup accepts and validates Strava segment URLs.
- Explorer week activation is blocked until at least one destination exists.
- Active Explorer week renders in the Challenges hub.
- Athlete progress bar and checklist render correctly.
- Completers summary is visible and shows names.
- Manual refresh or backfill works.
- Explorer history persists and can be queried after week end.
- Existing leaderboard and admin regression checks pass.
- VERSION and CHANGELOG.md are updated with implementation.
- Explorer ideas backlog remains separate from the v1 scope.

End of PRD