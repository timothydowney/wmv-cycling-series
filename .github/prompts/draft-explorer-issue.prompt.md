---
name: Draft Explorer Issue
description: Draft a GitHub issue from a stable Explorer worklog item or approved implementation slice.
agent: agent
model: GPT-5 (copilot)
argument-hint: Provide the worklog item or approved Explorer slice to convert into an issue draft.
---

Draft a GitHub issue for WMV Explorer Destinations.

Use these sources when relevant:

- [Explorer PRD](../../docs/prds/wmv-explorer-destinations-prd.md)
- [Explorer technical spec](../../docs/prds/wmv-explorer-destinations-tech-spec.md)

Output a compact issue draft with:

1. Title
2. Problem statement
3. Scope
4. Acceptance criteria
5. Validation or test expectations
6. Related planning docs

Do not expand the approved scope. If the source item is still fuzzy, say so explicitly instead of inventing missing requirements.