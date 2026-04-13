---
name: explorer-planning
description: 'Plan WMV Explorer work from the PRD, tech spec, readiness checklist, and worklog. Use for readiness reviews, keeping planning docs aligned, and generating a safe next implementation slice before coding.'
argument-hint: 'Describe the Explorer planning task or ask for the next implementation slice.'
---

# Explorer Planning

## When To Use

- when reviewing whether Explorer is ready for implementation
- when updating the readiness checklist or worklog
- when reconciling the PRD, technical spec, and phases docs
- when turning planning docs into one bounded implementation slice
- when deciding whether a question blocks Phase 1 only or Phase 2+

## Primary References

- [Explorer PRD](../../../docs/prds/wmv-explorer-destinations-prd.md)
- [Explorer technical spec](../../../docs/prds/wmv-explorer-destinations-tech-spec.md)
- [Explorer phases](../../../docs/prds/wmv-explorer-destinations-phases.md)
- [Explorer readiness checklist](../../../docs/prds/wmv-explorer-readiness-checklist.md)
- [Explorer worklog](../../../docs/prds/wmv-explorer-worklog.md)
- [Explorer execution briefing](../../../docs/prds/wmv-explorer-execution-briefing.md)

## Procedure

1. Identify the planning surface involved: PRD, tech spec, phases, readiness checklist, or worklog.
2. Check whether the current branch is appropriate for the requested slice; if not, call for a fresh feature branch from updated `main` before substantial execution begins.
3. Check whether the request changes product intent, technical closure, execution boundaries, or simple task tracking.
4. Update or summarize the exact planning docs that should change.
5. State whether the result changes readiness status.
6. If the feature is ready enough to move forward, produce one small implementation slice tied to a specific phase and validation path.

## Output Expectations

Produce a compact planning result with:

- current readiness state
- what changed or should change in the planning docs
- blockers and non-blockers
- the recommended next slice
- the tests or validations the slice should carry
- the expected branch starting point if implementation should begin now

## Guardrails

- Keep Explorer additive to the current competition flows.
- Do not let ideas backlog items leak into v1 implementation slices.
- Do not ask for `VERSION` or `CHANGELOG.md` updates during planning; reserve them for the final pre-commit pass of a user-facing implementation commit.
- If a planning gap would force implementation to guess, treat it as a blocker instead of hand-waving it.