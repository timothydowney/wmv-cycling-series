# Product Requirements Document (PRD)

## WMV Explorer Seasons

| Field | Value |
| --- | --- |
| Product Name | WMV Explorer Seasons |
| Version | 0.2 |
| Author | GitHub Copilot |
| Date | 2026-04-12 |
| Status | Draft |

## 1. Executive Summary

WMV Explorer Seasons is a new participation feature for the WMV Cycling Series app that centers on exploration rather than competition. Instead of organizing riders around one weekly race segment, admins create a date-bounded Explorer season and curate a list of destinations that riders can complete at any time during that season. In the first implementation pass, admins must choose those destinations through Strava segments because segments are the only input WMV can later match back to athlete rides with deterministic confidence. Longer term, the product should be able to treat destinations more broadly than segments alone. The primary athlete experience is personal progress across the season: which destinations they have completed, how many remain, what is rare or popular across the club, and how their exploration is growing over time.

The first release should stay disciplined. Explorer Seasons v1 should support one active Explorer season at a time, automatic completion tracking from Strava activity ingestion, archived season visibility, separate participation preferences for Explorer, and a data-first athlete view with strong foundations for later UX expansion. The product should also store enough geographic and content primitives to support later map views, destination commentary, richer stats, personal or social activity feeds, and a later place-based destination model where new destinations can be created from first visits to a city, state, and country combination. Rider-facing destination presentation should use a hybrid model: the admin-authored label is primary, while the place implied by the segment, especially around the segment endpoint, provides supporting map and context detail. The v1 matching contract still remains exact segment recognition rather than fuzzy place inference.

Explorer must remain clearly separate from race scoring and leaderboard logic. It should support both outdoor and virtual riding when the available Strava data allows, surface aggregate participation insights without turning into a rider ranking table, and leave room for later weekly or holiday challenges inside a season.

## 2. Problem Statement

The current WMV Cycling Series product is optimized for competitive weekly participation. Seasons contain race-oriented weeks, weeks map to a single scoring segment, and athlete visibility is largely expressed through rankings and results. That works well for time-trial style participation, but it does not serve riders who want a lower-pressure way to join the club experience.

Existing gaps include:

- Participation is still framed mostly as competition rather than exploration.
- There is no season-based feature for collecting visits to a curated set of destinations.
- There is no rider-facing progress model for cumulative destination completion over time.
- There is no simple way for admins to publish an exploration campaign that is not tied to race-week structure.
- There is no participation preference that lets a rider opt out of Explorer while remaining connected to the club.
- There is no aggregate exploration view showing what is popular, rare, untouched, or uniquely discovered.
- There is no stored geographic representation of destinations suitable for an Explorer map view.

WMV Explorer Seasons addresses these gaps by introducing a separate, progress-first product area that rewards participation and discovery without turning it into another leaderboard.

## 3. Goals & Objectives

| Goal | Description | Success Signal |
| --- | --- | --- |
| Expand participation beyond racing | Give club members a reason to engage even when they are not chasing times or rank | Riders can make visible progress without appearing on a competition leaderboard |
| Create a durable Explorer foundation | Start with a simple season-wide model that can later support weekly sub-challenges and place-based destinations | Explorer data remains useful after the first season and can be extended without a rewrite |
| Keep admin setup simple | Let admins create a season and populate it from a source that can later be matched with certainty | Admin can define an Explorer season in a small number of steps |
| Reuse existing ingestion patterns | Track completion from Strava activity and segment data instead of manual rider submissions | Explorer completions are generated automatically from synced activities |
| Preserve the non-competitive tone | Emphasize personal progress and aggregate exploration insights rather than rankings | Athlete-facing Explorer views do not show rank-order competition |
| Give riders control over participation | Riders are opted in by default but can opt out of Explorer entirely | Opted-out riders are excluded from Explorer matching and Explorer stats |
| Build toward richer UX safely | Store enough content and map primitives to evolve the experience during the season | Later views such as map, feed, and richer destination storytelling can reuse the v1 model |
| Keep competition flows stable | Add Explorer without compromising current leaderboard behavior | Existing season, week, result, and webhook competition flows continue to work |

## 4. Target Audience

| Audience | Description | Primary Need |
| --- | --- | --- |
| Existing WMV athlete | Current rider already using the app for race-style participation | A lower-pressure way to stay engaged across a season |
| Casual or exploratory rider | Rider more motivated by route variety and completion than by speed | A personal checklist of destinations to explore |
| Virtual or hybrid rider | Rider who completes rides indoors, outdoors, or both | Inclusive Explorer tracking when configured destination-recognition inputs are valid in Strava |
| Club admin | Organizer who wants offseason or parallel participation programming | A clean workflow to create and manage an Explorer season |

## 5. User Stories

### 5.1 Athlete Experience

| ID | User Story | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| US-01 | As an athlete, I want to see the active Explorer season so I understand what I can work on now | Must | The app clearly shows the current Explorer season and its date range |
| US-02 | As an athlete, I want archived Explorer seasons to remain visible so past campaigns still feel meaningful | Should | The app provides a way to browse closed Explorer seasons |
| US-03 | As an athlete, I want to see all destinations included in the Explorer season so I know what counts | Must | The Explorer season page lists every configured destination in a stable order |
| US-04 | As an athlete, I want to see how many destinations I have completed so I can track my progress | Must | The page shows completed versus total destinations for the logged-in athlete |
| US-05 | As an athlete, I want each destination to count at most once for me during the season so the rules stay simple | Must | Repeated visits to the same destination do not increase completion count |
| US-06 | As an athlete, I want to know which specific destinations I have completed and which remain | Must | Each destination shows complete or incomplete state for the logged-in athlete |
| US-07 | As an athlete, I want Explorer to support virtual and outdoor riding when Strava data allows so the feature feels inclusive | Must | Destination eligibility is based on configured Explorer matching inputs rather than a race-only model |
| US-08 | As an athlete, I want the Explorer experience to feel personal rather than competitive | Must | My Explorer view does not rank me against other riders |
| US-09 | As an athlete, I want to browse a small set of aggregate destination stats so I can see what is popular, rare, or untouched | Must | The Explorer season page shows a concise set of aggregate insights without turning into a rider leaderboard |
| US-10 | As an athlete, I want to know if I am the only rider who has completed a destination so the app can surface unique discoveries | Should | My Explorer stats can identify destinations where I am currently the sole completer |
| US-11 | As an athlete, I want to opt out of Explorer participation from my profile so I can stop being included in this feature | Must | Explorer participation is enabled by default, but a profile control can disable Explorer matching and Explorer stats for that rider |
| US-12 | As an athlete, I want a data-oriented Explorer view focused on progress and stats | Must | Explorer v1 provides a data-first view suitable for tracking progress and season analytics |
| US-13 | As an athlete, I want a map-based Explorer view so I can understand where destinations are in the world | Could | The product can later render destinations on a map using stored Explorer location primitives |
| US-14 | As an athlete, I want to search the map by address or place so I can move the map to areas I care about | Could | A future map view can geocode a place query and reposition the map |
| US-15 | As an athlete, I want to search for destinations by name in the map search box so I can quickly find them | Could | A future map experience can search stored destination labels and center on the result |
| US-16 | As an athlete, I want a personal Explorer activity feed showing my rides and which destinations I checked off on each ride | Could | A later Explorer view can show my season activities and matched destinations per activity |

### 5.2 Club Visibility And Analytics

| ID | User Story | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| US-17 | As a club member, I want to see which Explorer destinations are most visited so the campaign feels alive | Must | The app can identify and display most visited destinations |
| US-18 | As a club member, I want to see which Explorer destinations are rare or untouched so the season encourages discovery | Must | The app can identify rarest completed destinations and destinations with zero completions |
| US-19 | As a club member, I want season-wide participation metrics so I can understand how broadly the campaign is landing | Should | The app can summarize opted-in rider participation at the season level |
| US-20 | As a club member, I do not want Explorer stats to turn into a rider ranking table | Must | Aggregate views focus on destination participation and season progress rather than athlete ordering |

### 5.3 Admin Experience

| ID | User Story | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| US-21 | As an admin, I want to create a dedicated Explorer season bounded by dates so it can run independently from race seasons | Must | Admin can create an Explorer season with name, start date, and end date |
| US-22 | As an admin, I want only one Explorer season active at a time so the athlete experience stays clear | Must | The system prevents more than one Explorer season from being active concurrently |
| US-23 | As an admin, I want to add destinations using a workflow that guarantees later rider matching | Must | In v1, admin can paste a Strava segment URL and the system extracts the segment ID for exact later matching |
| US-24 | As an admin, I want the system to retain useful destination metadata for display so riders see stable names and context | Must | Explorer destinations store stable display metadata after creation |
| US-25 | As an admin, I want to override the display name of a destination so I can present places more clearly than the raw segment name | Must | Explorer destinations support an admin-controlled display label |
| US-26 | As an admin, I want to provide commentary about a destination so the Explorer season feels curated and informative | Must | Explorer destinations support markdown-based commentary using the app’s existing markdown patterns |
| US-27 | As an admin, I want to reorder Explorer destinations so the season page feels intentionally curated | Should | Admin can control destination display order |
| US-28 | As an admin, I want Explorer management to be clearly separate from race season setup so the two concepts do not get confused | Must | Explorer uses its own admin surface or clearly separated section |
| US-29 | As an admin, I want to refresh or backfill Explorer matching so missed or late-connected activities can be recovered | Must | Admin can trigger a safe reprocess path for an Explorer season when prior rides need to be reconsidered |
| US-30 | As an admin, I want Explorer seasons to require at least one destination before publication so riders never see an empty campaign | Must | An empty Explorer season cannot be activated or published |
| US-31 | As an admin, I want a destination to remain in the season even if its source segment later disappears from Strava | Should | The destination remains visible with cached metadata and is marked unavailable for new matches until repaired or replaced |

## 6. MoSCoW Prioritization

### Must Have (MVP)

| Item | User Stories | Rationale |
| --- | --- | --- |
| Separate Explorer Seasons product area | US-01, US-21, US-28 | Explorer must not be confused with race seasons |
| One active Explorer season at a time | US-01, US-22 | Keeps the mental model simple in v1 |
| Active Explorer season data view | US-01, US-03, US-04, US-06, US-12 | Core season-based experience |
| Personal season progress summary | US-04, US-06, US-08 | Primary rider interaction model |
| One completion per destination per rider per season | US-05 | Keeps rules simple and durable |
| Deleted or invalidated activities remove completion when they were the qualifying source | US-05 | Explorer must remain accurate when source activities change |
| Explorer participation opt-out with default opt-in | US-11 | Riders need control without blocking simple onboarding |
| Strava URL-based destination setup for v1 | US-23 | It is the simplest authoring flow that also guarantees deterministic later matching from athlete rides |
| Stable destination metadata storage | US-24 | Prevents fragile UI driven by transient API values |
| Admin display-name override | US-25 | Raw segment names are not always the best storytelling label |
| Admin markdown commentary for destinations | US-26 | Explorer should support curated destination context from day one |
| Concise aggregate destination stats | US-09, US-17, US-18, US-20 | Makes Explorer social without becoming competitive |
| Season-wide participation metrics | US-19 | Gives the club a read on adoption without a rider leaderboard |
| Refresh or backfill action | US-29 | Required for operational recovery |
| Activation requires at least one destination | US-30 | Prevents empty Explorer seasons from going live |
| Automatic completion from Strava activity ingestion | — | Avoids manual rider reporting |
| Separate Explorer data model | US-21, US-28 | Avoids overloading competition tables and semantics |
| Stored Explorer map primitives | US-13 | v1 should store enough location data to power follow-on map UX without a schema redo |

### Should Have (Enhanced Experience)

| Item | User Stories | Rationale |
| --- | --- | --- |
| Archived Explorer season browsing | US-02 | Helps the feature feel durable after season end |
| Destination ordering | US-27 | Improves curation and storytelling |
| Explorer-specific empty states and help text | US-08 | Clarifies the intent of the product for first-time users |
| Detected virtual or outdoor indicator when available | US-07 | Adds useful context without changing eligibility rules |
| Unique discovery stat for the logged-in rider | US-10 | A good non-competitive motivator for exploration |
| Initial destination commentary presentation | US-26 | Encourages riders to treat destinations as places, not just IDs |

### Could Have (Follow-On UX)

| Item | User Stories | Rationale |
| --- | --- | --- |
| Map view with destination plotting | US-13 | Strong fit for the product, but not required to validate v1 data flow |
| Map search by address or place | US-14 | Requires geocoding choice beyond Strava |
| Destination search inside the map experience | US-15 | Strong usability enhancement once a map exists |
| Personal Explorer activity feed | US-16 | Useful but secondary to getting the primitives and stats right |
| Destination categories such as scenic, climb, event, or gravel | — | Adds editorial flavor without affecting the core model |
| Auto-created place destinations from first city/state/country visits | — | Strong future fit, but depends on a trustworthy place-matching model beyond v1 segment handling |

### Won't Have (v1.0 - Future Consideration)

| Item | Rationale |
| --- | --- |
| Weekly or holiday Explorer sub-challenges | Defer until the season model is proven |
| Rank-ordered athlete leaderboard | Conflicts with Explorer product intent |
| Public participant-by-participant completion roster | Increases social comparison too early |
| Shared social feed showing all riders’ Explorer activity | Save until the personal feed and participation model are proven |
| Bonus scoring, badges, or streak systems | Keep the first release simple |
| Multi-sport support such as hiking | Validate cycling first |
| Reusing competition season and week tables via a type flag | Adds unnecessary coupling and migration risk |

## 7. UI/UX Specifications

### 7.1 Athlete View

Explorer v1 should present one active Explorer season at a time with a data-first, progress-first layout:

- Header area with Explorer season name, date range, and a short explanation of how completion works.
- Personal progress summary showing completed destinations versus total destinations.
- Destination collection view showing every configured Explorer destination with complete or incomplete state for the logged-in athlete, using a hybrid presentation of admin-authored label plus supporting endpoint or place context when available.
- Aggregate stats area highlighting a concise day-one stat set: visited destinations, never-visited destinations, most popular destination, and least popular destination.
- Clear indication when a rider has unique discoveries that no other opted-in rider has completed.
- Lightweight empty or disconnected states when a rider has no completions yet.

The initial release should optimize for a reliable data-oriented view. The product should be structured so a later map view and a later personal Explorer activity feed can be introduced without reworking the underlying Explorer model.

### 7.2 Admin View

The Explorer admin area should support:

- Create or edit Explorer season metadata.
- Enforce date-bounded seasons with only one active season at a time.
- Add destinations one at a time from the best-supported source flow in v1, which is pasted Strava segment URLs.
- Make clear that the pasted segment is the recognition proof WMV will later use to confirm a rider reached that destination.
- Review stored destination metadata before publication.
- Override display names when the raw segment title is not ideal, with the system still able to show supporting endpoint or place context below that label.
- Add markdown commentary about a destination using the app’s established markdown editing and display patterns.
- Reorder destinations when desired.
- Run refresh or backfill actions when the admin intentionally wants prior rides reconsidered.
- Allow live edits to active seasons without forcing a separate publish workflow for every change.
- Publish or activate only when the season has at least one destination.
- Preserve cached destination metadata and prior completion history even if a source segment later becomes unavailable.

### 7.3 UX Principles

| Principle | Description |
| --- | --- |
| Progress over ranking | Explorer should feel like a personal journey, not a leaderboard |
| Season-first framing | Riders should understand they are working through one campaign over time |
| Clear separation from competition | Explorer terminology and layout should not mimic race week UI |
| Low cognitive load | Rules should be understandable in a few seconds |
| Aggregate, not comparative | Social visibility should be about destinations and participation trends, not rider ordering |
| Exploration as storytelling | Admin labels and commentary should help destinations feel like places worth visiting |

### 7.4 Responsive Behavior

| Breakpoint | Behavior |
| --- | --- |
| Desktop | Progress summary, destination collection, and stats can be scanned quickly |
| Tablet | Destination collection remains central; summary cards compress cleanly |
| Mobile | Header, progress, destinations, and stats stack in a clear reading order |

## 8. Non-Functional Requirements

### 8.1 Performance

| Requirement | Target | Validation |
| --- | --- | --- |
| Explorer season load | Comparable to other existing app views | Manual QA and query sanity checks |
| Matching idempotency | Reprocessing does not create duplicate completions | Automated backend tests |
| Aggregate stats performance | Common season queries remain responsive | Backend tests and manual verification |

### 8.2 Data Integrity

| Requirement | Target | Validation |
| --- | --- | --- |
| One completion per destination per rider per season | Duplicate activity matches never overcount | Automated backend tests |
| Correct season boundaries | Only activities inside the Explorer season count | Boundary tests for start and end timestamps |
| Durable history | Explorer completion remains queryable after the season ends | Integration tests |
| Webhook and refresh parity | Real-time and manual refresh paths produce the same completion results | Automated backend tests |
| Completion reversal | Deleted or invalidated activities remove destination completion when appropriate | Automated backend tests |

### 8.3 Privacy And Access

| Requirement | Target | Validation |
| --- | --- | --- |
| Athlete completion visibility | v1 athlete views show personal completion state only | Product QA |
| Aggregate stats exposure | Shared stats do not expose rank-order athlete comparisons | Product QA |
| Explorer opt-out behavior | Opted-out riders are excluded from Explorer matching, Explorer stats, and future Explorer feeds | Product QA and backend tests |
| Admin control | Only admins can create, edit, publish, or refresh Explorer seasons | Backend authorization tests |

### 8.4 Geographic Data Readiness

| Requirement | Target | Validation |
| --- | --- | --- |
| Destination placement primitives | Explorer stores enough location data to place destinations on a map later | Backend tests and schema review |
| Destination geometry support | Explorer can persist or derive line or bounds data when available from its source data | Technical review |
| Deterministic recognition | V1 destination completion is based on exact segment identity rather than fuzzy place inference | Backend tests and technical review |
| Virtual segment caveat handling | The product tolerates unusual virtual segment coordinates without breaking the map model | Product QA and follow-on UX review |

### 8.5 Accessibility

| Requirement | Target | Validation |
| --- | --- | --- |
| Completion visibility | Complete and incomplete state is understandable without color alone | Manual QA |
| Destination collection semantics | Explorer progress UI is screen-reader friendly | Accessibility review |
| Keyboard navigation | Core Explorer interactions are keyboard accessible | Manual QA |

## 9. Risks & Mitigations

| Risk | Impact | Severity | Mitigation |
| --- | --- | --- | --- |
| Explorer drifts toward leaderboard behavior | Weakens the purpose of the feature | High | Keep athlete views personal and aggregate rather than comparative |
| Reusing competition season semantics creates coupling | Makes Explorer harder to evolve and riskier to ship | High | Use separate Explorer entities and admin flows |
| Invalid Strava URLs or stale source metadata | Leads to confusing season configuration | Medium | Validate inputs, extract source identifiers safely, and store stable display metadata |
| Missing completions due to late auth or webhook gaps | Riders see incomplete progress | Medium | Provide explicit refresh or backfill actions |
| Deleted activities leave stale completions | Explorer stats become inaccurate | Medium | Track completion provenance to the qualifying activity and reverse it when needed |
| Segment-based recognition is an imperfect destination proxy | Some destinations may be represented by multiple nearby routes or odd segment choices | Medium | Treat segments as a practical first proxy while leaving room for richer place models later |
| Source segment later disappears or becomes inaccessible | Admins may worry the destination or its history has been lost | Medium | Preserve cached destination metadata and existing completion history while marking the destination unavailable for new matches |
| Fuzzy destination matching is introduced too early | Riders and admins may lose trust in what counts as a visit | High | Keep v1 matching exact by segment identity and defer endpoint-tolerance confidence matching to a later phase |
| Map data is imperfect, especially for virtual segments | Future map UX may show surprising placement | Medium | Store coordinates and geometry now, and document virtual-segment caveats in later map work |
| Aggregate stats become noisy or unclear | Users do not understand what the season is encouraging | Medium | Start with a concise stat set and expand only after observing usage |

## 10. Success Criteria

The v1 release is successful if:

1. Admins can create an Explorer season with a date range.
2. The system allows only one active Explorer season at a time.
3. Admins can add v1 destinations to that season from pasted Strava segment URLs.
4. Admins can override destination names and add markdown commentary.
5. Explorer seasons cannot be published without at least one configured destination.
6. Athletes can see their personal Explorer season progress in a data-oriented view.
7. Riders are opted in by default but can opt out of Explorer from their profile.
8. Each destination counts at most once per rider for the season.
9. Deleted or invalidated activities remove completions when appropriate.
10. Aggregate Explorer stats are visible without exposing a rider leaderboard.
11. Archived Explorer seasons remain visible.
12. The resulting data model leaves clear room for later map views, activity feeds, season replication, rider-submitted destinations, weekly or holiday challenges inside a season, and later confidence-based destination matching beyond exact segment identity.

## 11. Recommended Initial Stats Set

The first athlete-facing Explorer stats set should stay readable and clearly non-competitive.

### 11.1 Day-One Athlete Stats

- Completed destinations count.
- Percent of season completed.
- Number of destinations that have been visited by at least one opted-in rider.
- Number of destinations that have never been visited.
- Most popular destination.
- Least popular completed destination.

### 11.2 Supporting Runtime Metrics

These may be computed on read in v1 rather than cached:

- Total destinations in the active season.
- Per-destination completion counts among opted-in riders.
- Whether a destination has zero completions.

### 11.3 Candidate Follow-On Stats

- Unique discoveries where the logged-in rider is the only opted-in rider with that destination completed.
- Percent of opted-in riders with at least one completion.
- Percent of opted-in riders who completed the full season.
- New completions this week inside an ongoing season.
- Destination completion trends over time.
- Geographic clusters or region rollups.
- Commentary-driven highlights such as featured or hidden-gem destinations.

## 12. Map Feasibility Research Notes

Initial research against Strava’s API model indicates that Explorer can be made map-capable later if v1 stores the right primitives.

- Strava segment representations include `start_latlng` and `end_latlng` coordinates, plus city, state, and country fields.
- Detailed segment representations also include `map.polyline`, which is enough to render a segment path or estimate bounds.
- Strava segment streams can return `latlng` data, which provides a more explicit geometry source when needed.
- Strava activity data can also contain `location_city`, `location_state`, and `location_country`, which are useful hints for future destination matching but are not reliable enough to be the sole v1 foundation.
- The primary v1 recognition rule should remain exact segment identity through activity segment efforts, because this is the only matching path WMV can explain and trust with certainty.
- Search by destination name can be powered by stored source names, display labels, and commentary metadata inside WMV.
- Search by place or address will require a separate geocoding capability outside Strava.
- Public OpenStreetMap tiles are acceptable for normal interactive use if WMV follows the tile policy, attribution, and caching requirements, but they are best-effort and have no SLA.
- Public Nominatim is acceptable only for moderate user-triggered use, with an absolute maximum of 1 request per second, no autocomplete, strong caching expectations, and provider-switch flexibility.
- Because WMV already has Google billing enabled and its expected usage is small, Google Maps Platform is now a credible default managed option rather than only a fallback. Current public free thresholds such as 10,000 monthly Dynamic Maps loads and 10,000 monthly Geocoding requests are likely sufficient for the initial Explorer map use case.
- Google Places features are still worth using selectively because autocomplete and richer place search can create more billable events than a simple map plus direct geocoding flow.
- A later destination-recognition model could use segment endpoint coordinates, stored destination coordinates, and a configured spatial tolerance to infer likely visits with lower confidence than exact segment matching.
- Virtual segments may still have coordinates, but they may appear in places that feel odd on a real-world map. Explorer should treat this as acceptable but noteworthy rather than as a blocker.

This means the v1 planning target should be: store enough map-related data now, even if the first shipped athlete view remains data-first.

## 13. Future Considerations (Post v1.0)

| Future Item | Priority | Notes |
| --- | --- | --- |
| Weekly or holiday Explorer challenges inside a season | High | Likely the next major expansion once season-based Explorer is validated |
| Explorer map view with search and viewport controls | High | Strong fit once the data model is proven |
| Personal Explorer activity feed | Medium | Builds naturally on completion provenance and activity linkage |
| Shared club Explorer feed | Medium | Defer until participation controls and social tone are validated |
| Explorer badges and streaks | Medium | Depends on stable participation data and product confidence |
| Auto-created place destinations from city, state, and country visits | Medium | Likely needs a source-type-aware model, normalized place keys, and more than raw activity place strings alone |
| Endpoint or coordinate-tolerance destination matching | Medium | Strong future fit, but only after the exact-match model is proven and a confidence policy exists |
| Season replication or templating | High | Admins will likely want to reuse and adapt destination sets |
| Rider-submitted destination proposals | Medium | Useful after core moderation and curation flows exist |
| Multi-sport expansion | Medium | Explore after cycling-specific behavior is proven |
| Richer admin search and curation tools | Medium | Improves season authoring after the core flow is stable |
| Lightweight destination grouping such as route family or region | Medium | Start generic and avoid overcommitting to geography before the data model is proven |

## 14. Relationship To Existing Explorer Docs

The earlier weekly Explorer concept remains useful, but it should no longer be treated as the canonical v1 definition.

- The renamed weekly-challenges PRD set captures a possible future model where Explorer includes weekly destination packs and timed experiences.
- This Explorer Seasons PRD is the canonical document for the simpler season-first starting point.
- Weekly or holiday windows should be evaluated later as a child concept inside an Explorer season rather than as the first implementation slice.

## 15. Open Questions

The following questions are useful for the next planning round and are no longer about the core season model itself.

1. Should route family be the first lightweight grouping concept, with geographic region deferred until the map and place model are better understood?
2. What geocoding provider and frontend map stack should eventually power address and place search in the Explorer map view while staying low cost, within fair use, and provider-swappable?
3. Should archived seasons eventually get their own summary cards or comparison view, or is a simple archive list enough?
4. How much completion provenance should the personal feed preserve in v1 data structures, even if the UI ships later?
5. When the product later supports season replication, should admins clone all destinations and commentary by default, or selectively choose what to carry forward?
6. When rider-submitted destinations are introduced later, what review or approval workflow should admins have?
7. When Explorer later supports auto-created place destinations, should those appear automatically, require admin approval, or land in a draft queue first?
8. If Explorer later introduces endpoint-based or coordinate-tolerance matching, what level of spatial tolerance is acceptable before rider and admin trust starts to erode?

## 16. Success Of Implementation

### 16.1 Definition Of Done

| Area | Definition | Validation |
| --- | --- | --- |
| Feature completeness | All Must Have PRD items are implemented and functional | Manual QA plus automated tests |
| Architecture compliance | Explorer uses separate Explorer models and shared matching services | Code review and backend tests |
| Data integrity | Explorer completion is stored correctly without duplicate counting and can be reversed when source activity data changes | Integration tests |
| UX compliance | Athlete views emphasize personal progress and aggregate destination stats without ranking riders | Product QA |
| Participation control | Explorer opt-out works and excludes riders from Explorer matching and Explorer stats | Product QA and backend tests |
| Geographic readiness | Explorer stores enough location data to support a later map experience | Code review and technical validation |
| Regression safety | Existing race leaderboard and webhook behavior continue to work | Regression suite |

### 16.2 Launch Checklist

- Explorer season creation works in admin UI.
- Only one Explorer season can be active at a time.
- Destination setup accepts and validates Strava segment URLs.
- Explorer season activation is blocked until at least one destination exists.
- Admins can override destination names and provide markdown commentary.
- Active Explorer season renders in the app.
- Archived Explorer seasons remain visible.
- Athlete progress renders correctly.
- Aggregate destination and season stats render correctly.
- Explorer opt-out works from the profile experience.
- Refresh or backfill works safely.
- Deleted or invalidated activities remove completions when appropriate.
- Explorer completion persists after the season ends.
- Existing leaderboard and admin regression checks pass.
- The weekly-challenges docs remain available as future reference.