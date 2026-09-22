# Leaderboard Design System

This document defines the current gold-standard UI language for the app's modern surfaces.

Historical note:
- the file keeps the leaderboard name because the Weekly, Season, and Schedule surfaces established the strongest baseline first
- going forward, touched modern surfaces and admin work should also use this system as the default reference unless a better documented pattern replaces it

Scope:
- Weekly leaderboard
- Season leaderboard
- Schedule tab
- Segment-linked surfaces reused inside those tabs
- Shared primitives those tabs already use

Out of scope:
- Legacy admin screens that have not yet been brought forward into this system
- Undocumented one-off admin styling used only for historical compatibility
- New form-control systems that do not yet exist in the documented app design system

## Source Of Truth

Use these files in this order when building or reviewing leaderboard-style UI:

| Area | Source file | Role |
| --- | --- | --- |
| Global tokens and typography | `src/index.css` | Brand colors, text colors, font scale, heading defaults |
| App-level layout | `src/App.css` | Main content width, page spacing, table baseline |
| Shared card shell | `src/components/Card.css` | Card container, collapsed header, expanded details, chip primitives |
| Weekly header pattern | `src/components/WeeklyHeader.tsx` | Primary hero card for weekly and schedule surfaces |
| Weekly participant card | `src/components/LeaderboardCard.tsx` | Rank card composition, expanded detail treatment |
| Season participant card | `src/components/SeasonCard.tsx` | Season-card hierarchy and compact metadata pill treatment |
| Segment card primitive | `src/components/SegmentCard.tsx` and `src/components/SegmentCard.css` | Compact segment title and metadata treatment |
| Segment profile wrapper | `src/components/CollapsibleSegmentProfile.tsx` | Collapsible segment-detail heading and reveal pattern |
| Weekly tab composition | `src/components/WeeklyLeaderboard.tsx` | Card stacking, expansion rhythm, no-results state |
| Schedule tab composition | `src/components/ScheduleTable.tsx` and `src/components/ScheduleTable.css` | Week-list rhythm, next-up badge, schedule expansion layout |
| Bottom navigation | `src/components/BottomNav.tsx` and `src/components/BottomNav.css` | Fixed mobile-first peer-view navigation for Weekly, Season, and Schedule views |

If a new UI conflicts with these files, the new UI should usually change before the leaderboard primitives do.

## Foundations

### Color Tokens

All new leaderboard-inspired UI should start from the tokens in `src/index.css`:

- `--wmv-purple`: primary heading and brand accent
- `--wmv-purple-dark`: stronger hover or active purple
- `--wmv-orange`: interactive accent, CTA, badge, and highlight color
- `--wmv-orange-hover`: orange hover state
- `--wmv-orange-light`: warm orange-tinted background
- `--wmv-text-dark`: primary body text
- `--wmv-text-light`: secondary metadata text
- `--wmv-border`: neutral borders and dividers
- `--wmv-bg-light`: muted chip and expanded-panel background
- `--wmv-white`: card and surface background

Rules:
- Prefer these variables over hardcoded hex values.
- If a new token is needed, add it centrally instead of scattering one-off colors.
- Public leaderboard-inspired UI should avoid borrowing colors from legacy admin screens unless they are promoted into tokens first.

### Typography

The global type system lives in `src/index.css`.

- Body copy inherits the system sans stack declared on `:root`.
- Headings use the same sans stack with `font-weight: 700` and `color: var(--wmv-purple)` by default.
- The responsive scale is tokenized through:
  - `--font-xs`
  - `--font-sm`
  - `--font-base`
  - `--font-lg`
  - `--font-xl`
  - `--font-2xl`

Rules:
- Prefer the tokenized font scale over hardcoded pixel values.
- For card titles and key metadata, reuse existing leaderboard classes before inventing new font rules.
- Let section, hero, and card headings keep the default WMV purple unless the surface is intentionally acting like a dense row or compact object title.
- Reserve `var(--wmv-text-dark)` for primary values, participant identity, compact destination or segment titles, and other dense data surfaces rather than flattening every heading to dark body text.
- Secondary metadata should usually sit on `var(--wmv-text-light)` and `var(--font-sm)` or smaller.
- Progress annotations, completion copy, helper text, and empty-state body copy should usually stay on `var(--wmv-text-light)` unless product meaning requires stronger emphasis.

### Layout And Spacing

The page container standard comes from `src/App.css`:

- `.app-content` uses a centered max width of `1280px`
- page padding is `clamp(1rem, 4vw, 2rem)`
- major app sections breathe with `gap: 2rem`

Leaderboard components then work on a tighter internal rhythm:

- card margin bottom: `12px`
- common vertical list gap: `16px`
- header gap: `8px`
- expanded-detail padding: `16px 16px 24px 16px`
- large header cards such as `WeeklyHeader` use `24px` internal padding and `16px` radius

Rules:
- Prefer the existing 4px, 8px, 12px, 16px, 24px cadence.
- Do not introduce heavier spacing systems in new surfaces unless the leaderboard primitives cannot express the layout.

## Core Primitives

### Card Shell

`src/components/Card.css` is the main reusable shell.

Key classes:
- `.leaderboard-card`
- `.leaderboard-card.current-user`
- `.card-header`
- `.card-jersey`
- `.card-rank`
- `.card-avatar`
- `.card-main-info`
- `.card-name`
- `.card-points-row`
- `.card-right-side`
- `.card-time`
- `.card-chevron`
- `.card-expanded-details`

Behavior rules:
- cards are white with subtle shadow, 12px radius, and slight hover lift
- the current-user modifier adds orange emphasis without replacing the core shell
- expanded details use a light inset panel and stay visually attached to the collapsed header
- hover and expansion motion should stay subtle and fast

### Chip Pattern

The standard compact metadata badge is `.week-header-chip` with optional `.week-header-chip-icon`.

Characteristics:
- inline-flex layout
- muted background using `var(--wmv-bg-light)`
- rounded 16px pill shape
- medium-weight text
- subdued metadata color using `var(--wmv-text-light)`

Use this for:
- participant count
- distance
- elevation
- grade
- compact location or status metadata when it fits the same semantic weight

Avoid replacing it with bespoke pill systems unless the new component needs a materially different role.

### Expandable Surface Pattern

The leaderboard uses two related expansion patterns:

1. `Card.css` expansion via `.card-expanded-details`
2. header-to-detail overlap in `WeeklyLeaderboard.tsx` and `ScheduleTable.tsx`

Common traits:
- expansion appears attached to the trigger surface
- detail background is lighter than the collapsed surface
- animation is modest and short-lived
- the expanded layer should not visually compete with the main card shell

Interaction rules:
- the caret is the dedicated expand or collapse affordance when a surface exposes one
- on row-like or card-header surfaces with multiple actions, place the caret at the far right unless there is a strong, documented reason not to
- do not place a primary edit action to the right of the caret on the same row, because that weakens the collapse affordance

### Segment Metadata Card Pattern

`src/components/SegmentCard.tsx` and `src/components/SegmentCard.css` define a compact metadata card that is not the same thing as a leaderboard row.

Use this pattern when the UI is presenting a segment-like object as a compact reference card rather than as a ranked participant row.

Defining traits:
- title line uses `var(--font-base)` with a dark text heading tone
- the segment name itself is the Strava link
- the link uses the orange `.segment-link` treatment with `font-weight: 600`
- optional identity metadata such as the segment ID appears as a warm pill, not as dominant body text
- secondary metadata sits below the title in a single compact row with muted tone and bullet separators
- location, distance, and average grade live at the same hierarchy level unless product requirements elevate one of them

Rules:
- use this pattern as the primary source of truth when segments are acting as reference objects rather than leaderboard standings
- do not force these objects into `leaderboard-card` row anatomy when there is no rank, avatar, or right-side value hierarchy

### Segment Profile Reveal Pattern

`src/components/CollapsibleSegmentProfile.tsx` defines the segment-profile reveal used inside Weekly and Schedule expanded states.

Defining traits:
- the section label is uppercase, compact, and secondary in tone
- the profile toggle is lightweight and text-led, not a large button chrome treatment
- the reveal animation is small and attached to the parent expanded surface
- the profile content is subordinate to the parent week card, not a competing hero surface

Rules:
- prefer a lightweight heading-plus-chevron reveal before introducing a new detail container system

## Tab-Specific Patterns

### Bottom Navigation

Source files:
- `src/components/BottomNav.tsx`
- `src/components/BottomNav.css`

Defining traits:
- fixed to the bottom edge of the viewport
- three peer views presented as icon-plus-label items
- active item uses orange highlight while inactive items stay muted
- built for app-level mode switching, not for inline filtering or segmented control behavior
- supported by a spacer in content flow so the last card is not hidden behind the nav

Rules:
- when a leaderboard-inspired surface needs switching between peer views such as Weekly, Season, and Schedule, prefer this bottom-nav pattern first
- do not replace this with pill tabs, chip toggles, or a top-of-card segmented control unless a new navigation primitive is intentionally documented
- if one view or mode is not ready yet, keep the item visually present but clearly disabled rather than inventing a different navigation container
- keep icon weight, label scale, and active-state treatment aligned with `BottomNav.css`

### Weekly

Source files:
- `src/components/WeeklyLeaderboard.tsx`
- `src/components/WeeklyHeader.tsx`
- `src/components/LeaderboardCard.tsx`
- `src/components/WeeklyLeaderboard.css`

Defining traits:
- the week header is the hero surface for the page
- the week name itself is the Strava link, styled in orange with an inline external-link icon
- surrounding headings retain the WMV purple hierarchy instead of being reset to body-dark
- metadata directly under the title is quiet and compact
- detailed rider rows use the shared card shell, not bespoke component framing
- expanded rider details keep metrics and links compact, not dashboard-like
- segment profile reveal inside expanded notes uses the lightweight `CollapsibleSegmentProfile` pattern rather than a second hero card

### Season

Source files:
- `src/components/SeasonLeaderboard.tsx`
- `src/components/SeasonCard.tsx`

Defining traits:
- season cards reuse the same shell and hierarchy as weekly cards
- participant identity still leads the card
- compact pills can sit inside the card body when they read as secondary metadata
- the right side emphasizes the primary value, but without abandoning the shared card rhythm

### Schedule

Source files:
- `src/components/ScheduleTable.tsx`
- `src/components/ScheduleTable.css`
- `src/components/WeeklyHeader.tsx`

Defining traits:
- schedule reuses `WeeklyHeader` rather than inventing a parallel card shell
- the `Next Up` badge is a specific schedule affordance, not a general chip replacement
- expanded week content uses the same overlap-and-reveal idea as weekly notes
- CTAs remain visually subordinate to the main header card
- the segment name hierarchy is large and prominent, using `var(--font-2xl)` scale rather than compact metadata-card title sizing
- the segment link keeps the inline external-link arrow attached directly to the title text
- individual schedule entries should read as single primary surfaces, not stacks of nested boxes inside another card shell

## Link Rules

The public leaderboard establishes two important link conventions:

1. Important Strava segment or route titles are usually the link themselves.
2. External-link icons are inline companions to the text, not detached action buttons.

There are two valid title-link expressions in the current system:

- `WeeklyHeader` pattern: linked title plus inline external-link icon for a hero-level week surface
- `SegmentCard` pattern: linked title text without detached icon-first chrome for compact segment-object cards
- `Schedule` segment-entry pattern: a large title treatment using the same linked-name plus inline-arrow idea, but still rendered as one primary surface with chips beneath it

Rules:
- for route or week title links, prefer the linked-name pattern over a separate icon-only action
- use `var(--wmv-orange)` for high-signal interactive links tied to the sport object itself
- avoid button-styling normal navigation or outbound links when a text link is clearer
- choose between the `WeeklyHeader` link treatment and the `SegmentCard` link treatment based on hierarchy, not personal preference

## Action Controls

The app is still normalizing older admin screens, but the preferred pattern for modern compact actions is now explicit.

Rules:
- use icon-only action buttons when the action is obvious from context and an accessible name is provided through `aria-label`
- prefer circular icon buttons for compact row or card actions such as edit, delete, accept, reject, and collapse triggers
- keep action-button shape consistent within the same row or card; do not mix a rounded rectangle edit control with circular destructive or collapse controls unless the different weight is intentional and documented
- destructive actions should remain visually distinct through color treatment, not through a different button shape alone
- when an action opens a temporary editor, keep save as an explicit button and allow the editor to close back down after save or cancel

Current status note:
- older admin screens are still inconsistent, so this should be treated as the direction for new or touched surfaces rather than as a claim that every historical screen already matches it

## Patterns That Are Not Yet Fully Defined

The leaderboard does not yet provide a complete design system for:

- forms and field groups
- admin action buttons
- validation and toast states
- destructive actions
- dense configuration panels

When new or touched surfaces need these patterns:
- define them deliberately
- prefer tokenized colors and existing spacing rhythm
- document the new primitive once it stabilizes
- do not backfill from old admin CSS by default

## Design Audit Checklist

Before approving a new leaderboard-inspired UI, check:

1. Does it use `src/index.css` tokens instead of hardcoded colors and ad hoc font sizes?
2. Does it reuse `leaderboard-card`, `card-*`, or `week-header-chip` where the semantics match?
3. Does it use `SegmentCard` conventions when the surface is fundamentally a segment reference object rather than a ranking row?
4. Does the title, metadata, and value hierarchy feel consistent with Weekly, Season, Schedule, or Segment patterns?
5. If the surface switches between peer views, does it reuse the fixed bottom-nav pattern rather than inventing a local pill-tab system?
6. Is the link treatment consistent with the public leaderboard rather than legacy admin?
7. Are any new classes truly new primitives, or are they accidental duplicates of existing ones?
8. If a new primitive is real, has it been documented here or in a companion UI standard?

## Non-Authoritative References

These components may still be useful, but they do not outrank the leaderboard sources above for modern app UX:

- legacy admin panels
- older management screens such as season and segment admin views
- one-off exploratory component CSS

If these surfaces conflict with the leaderboard system, follow the leaderboard system unless product requirements explicitly say otherwise.