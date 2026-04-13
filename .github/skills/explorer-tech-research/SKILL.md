---
name: explorer-tech-research
description: 'Research external technical questions for WMV Explorer, such as mapping needs, API fit, pricing, licensing, and vendor tradeoffs. Use when Explorer planning depends on facts outside the repository.'
argument-hint: 'Describe the external question, such as mapping requirements or API options.'
---

# Explorer Tech Research

## When To Use

- when Explorer depends on third-party APIs or services
- when evaluating mapping or geospatial requirements
- when comparing vendor options, pricing, or licensing
- when the tech spec needs an external fact before a design decision can be closed

## Starting Context

Before researching externally, check the Explorer planning docs so the research stays scoped to the actual product need.

- [Explorer PRD](../../../docs/prds/wmv-explorer-destinations-prd.md)
- [Explorer technical spec](../../../docs/prds/wmv-explorer-destinations-tech-spec.md)
- [Explorer readiness checklist](../../../docs/prds/wmv-explorer-readiness-checklist.md)
- [Explorer worklog](../../../docs/prds/wmv-explorer-worklog.md)

## Procedure

1. Restate the product question in Explorer terms.
2. Identify the implementation decision that depends on external information.
3. Research only the information needed to close that decision.
4. Summarize tradeoffs in a way that can be copied into the tech spec or worklog.
5. State whether the finding removes a readiness blocker, creates a new constraint, or should be deferred.

## Output Expectations

Produce a concise research brief with:

- the decision being informed
- the options considered
- the main tradeoffs
- the recommended direction
- what should be updated in the planning docs

## Guardrails

- Keep research tied to a real Explorer decision.
- Do not turn optional future ideas into mandatory current scope.
- Prefer the smallest sufficient answer over broad market surveys.