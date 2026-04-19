---
name: leaderboard-design-audit
description: 'Audit or design modern WMV UI using the canonical Weekly, Season, and Schedule design system as the baseline for new app surfaces, including Explorer and touched admin flows.'
argument-hint: 'Describe the UI surface to audit or design and whether you want a gap analysis, implementation plan, or review against the current WMV design system.'
---

# Leaderboard Design Audit

## When To Use

- when building or reviewing Explorer UI
- when touching admin or other app surfaces that should follow the modern WMV design direction instead of legacy admin styling
- when aligning a new card, chip, header, action cluster, or schedule-like surface with the existing Weekly, Season, and Schedule UX
- when auditing typography, spacing, colors, chip treatment, action-button shape, or expansion behavior against the current WMV design system
- when deciding whether a new UI primitive is real or just a duplicate of an existing documented pattern

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

1. Confirm the work should follow the modern WMV design system rather than preserving legacy admin styling.
2. Read `docs/LEADERBOARD_DESIGN_SYSTEM.md` first.
3. Identify which leaderboard source files are the closest analog for the target UI.
4. Decide whether the target surface is primarily a ranking card, a hero header, a compact segment-object card, or a reveal panel.
5. Call out any gaps where the current design system does not define a stable pattern, especially forms and admin controls.
6. Recommend the smallest set of new styles necessary after reuse is exhausted.

## Output Expectations

Return a compact result with:

- the closest source-of-truth components
- what should be reused directly
- what needs a new primitive
- specific style or hierarchy mismatches
- a safe next implementation slice

## Guardrails

- Do not treat legacy admin as the UX source of truth for new or touched WMV surfaces.
- Prefer tokenized colors and font scale from `src/index.css` over hardcoded values.
- Prefer `leaderboard-card`, `card-*`, and `week-header-chip` over bespoke replacements when the semantics match.
- Prefer `SegmentCard` for compact segment or destination-object title and metadata styling when there is no ranking-row hierarchy.
- Prefer icon-only circular action buttons for obvious row or card actions when accessible labels are provided.
- Keep carets as the dedicated expand or collapse affordance and place them at the far right of mixed-action rows unless there is a documented reason not to.
- If the leaderboard does not yet define a pattern, name that gap explicitly instead of guessing.