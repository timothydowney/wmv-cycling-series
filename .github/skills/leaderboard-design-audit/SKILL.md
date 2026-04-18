---
name: leaderboard-design-audit
description: 'Audit or design leaderboard-inspired end-user UI using the canonical Weekly, Season, and Schedule design system.'
argument-hint: 'Describe the UI surface to audit or design and whether you want a gap analysis, implementation plan, or review.'
---

# Leaderboard Design Audit

## When To Use

- when building or reviewing Explorer end-user UI
- when aligning a new public-facing card, chip, header, or schedule-like surface with the existing leaderboard UX
- when auditing typography, spacing, colors, chip treatment, or expansion behavior against the Weekly, Season, and Schedule tabs
- when deciding whether a new UI primitive is real or just a duplicate of an existing leaderboard pattern

## Primary References

- `docs/LEADERBOARD_DESIGN_SYSTEM.md`
- `src/index.css`
- `src/App.css`
- `src/components/Card.css`
- `src/components/WeeklyHeader.tsx`
- `src/components/LeaderboardCard.tsx`
- `src/components/SeasonCard.tsx`
- `src/components/SegmentCard.tsx`
- `src/components/CollapsibleSegmentProfile.tsx`
- `src/components/WeeklyLeaderboard.tsx`
- `src/components/ScheduleTable.tsx`

## Procedure

1. Confirm the work is for the main end-user leaderboard design language, not legacy admin.
2. Read `docs/LEADERBOARD_DESIGN_SYSTEM.md` first.
3. Identify which leaderboard source files are the closest analog for the target UI.
4. Decide whether the target surface is primarily a ranking card, a hero header, a compact segment-object card, or a reveal panel.
5. Call out any gaps where the current leaderboard does not define a stable pattern, especially forms and admin controls.
6. Recommend the smallest set of new styles necessary after reuse is exhausted.

## Output Expectations

Return a compact result with:

- the closest source-of-truth components
- what should be reused directly
- what needs a new primitive
- specific style or hierarchy mismatches
- a safe next implementation slice

## Guardrails

- Do not treat legacy admin as the UX source of truth for public Explorer work.
- Prefer tokenized colors and font scale from `src/index.css` over hardcoded values.
- Prefer `leaderboard-card`, `card-*`, and `week-header-chip` over bespoke replacements when the semantics match.
- Prefer `SegmentCard` for compact segment or destination-object title and metadata styling when there is no ranking-row hierarchy.
- If the leaderboard does not yet define a pattern, name that gap explicitly instead of guessing.