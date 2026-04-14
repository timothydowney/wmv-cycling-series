# WMV Explorer Destinations Execution Briefing

This briefing explains how Explorer execution should use VS Code, Copilot CLI, and cloud agents once work moves from planning into approved implementation slices.

## Purpose

Explorer is the first feature expected to move through a PRD-first workflow in this repository. That means the planning set, readiness checklist, and worklog are the source of truth, and execution tools should reinforce that structure rather than bypass it.

## Core Rule

Do not start implementation from a vague chat summary. Start from an approved slice that points back to:

1. [The PRD](./wmv-explorer-destinations-prd.md)
2. [The technical spec](./wmv-explorer-destinations-tech-spec.md)
3. [The phases doc](./wmv-explorer-destinations-phases.md)
4. [The readiness checklist](./wmv-explorer-readiness-checklist.md)
5. [The worklog](./wmv-explorer-worklog.md)

Do not start an approved slice on an unrelated PR branch. For Explorer work, update `main` first and create a dedicated feature branch for the slice before substantial planning or coding continues.

## VS Code: Primary Environment

Use VS Code as the default environment for Explorer work.

### Use VS Code for

- PRD and technical-spec refinement
- readiness reviews and checklist updates
- worklog updates
- planning-agent and skill usage
- implementation slicing
- local code changes
- local tests, lint, typecheck, and build verification
- documentation updates
- reviewing cloud-agent output before merge

### Why VS Code is primary

- It has the richest repository context.
- It supports custom agents, skills, prompts, and local iteration in one place.
- It is the safest place to review changes before anything becomes a PR.

### Practical VS Code usage

Use the built-in Chat view as the main execution surface.

Example planning flow:

1. Select the `explorer-planner` agent from the agent picker.
2. Ask it to review readiness or prepare a slice, for example: `Review the Explorer readiness checklist against the tech spec and tell me the next approved implementation slice.`
3. If you want the reusable workflow instead of the role-specific agent, run `/explorer-planning` and ask for a readiness review, spec sync, or implementation-slice brief.
4. If the next step depends on external facts, run `/explorer-tech-research` with a concrete question, for example: `Compare mapping options for showing destination context in a later Explorer phase.`
5. When a worklog item stabilizes, run `/draft-explorer-issue` to turn it into a GitHub issue draft.
6. Once the slice is approved, switch to `dev-agent` for the actual code changes and local validation.

VS Code should be the place where you review the readiness checklist, update the worklog, decide the slice boundary, implement locally, and inspect any output from cloud-agent work.

## Copilot CLI: Supporting Shell Tool

Use Copilot CLI after a slice already exists and the task is terminal-centered.

### Use Copilot CLI for

- log interpretation
- command suggestions
- shell-heavy debugging support
- quick verification help while running tests or builds
- portable skill usage from a command-line workflow

### Do not use Copilot CLI for

- primary PRD or spec authoring
- readiness decisions
- deciding architecture from scratch
- replacing the worklog or checklist

### Repo-specific CLI note

Under WSL, use the Linux Node 24 toolchain rather than a Windows Node/npm path. Native modules such as `better-sqlite3` are sensitive to the wrong toolchain.

### Practical Copilot CLI usage

Use Copilot CLI when the conversation is really about terminal work, not about shaping the feature.

Good examples:

- after `npm test` fails, ask for help interpreting the failure and the next likely command or code area to inspect
- after `npm run typecheck` or `npm run build`, ask for help understanding a specific error burst
- while validating a finished slice, ask for a concise explanation of what a command sequence should verify

Avoid moving the main PRD, readiness, or slice-definition conversation into the CLI. The CLI should support execution, not replace the planning set.

## Cloud Agents: Bounded, Reviewable Tasks Only

Use cloud agents only after the readiness gate is passed for the relevant slice.

### Good cloud-agent tasks

- isolated repository research tied to one approved question
- implementing one narrow approved slice on a branch
- making targeted follow-up changes to an existing PR
- generating a reviewable PR for a bounded task

### Bad cloud-agent tasks

- resolving fuzzy product requirements
- inventing architecture where the tech spec is still undecided
- building an entire feature phase without a reviewed slice boundary
- bypassing local review in VS Code

### Cloud-agent input checklist

Any Explorer task sent to a cloud agent should include:

1. the exact phase or tech-spec section being implemented
2. the readiness status of blocking checklist items
3. the expected tests or validations
4. documentation expectations for that slice
5. a bounded outcome that can be reviewed through a PR

### Practical cloud-agent usage

Good first cloud-agent tasks for Explorer would look like this:

- `Implement the approved Explorer admin backend slice for createCampaign and addDestination, following the tech spec API surface and the current readiness checklist.`
- `Make the requested follow-up changes on an existing Explorer PR after review comments, keeping the scope to the listed files and tests.`

Bad first cloud-agent tasks would look like this:

- `Build Explorer.`
- `Figure out the schema and UI for Explorer and open a PR.`

The difference is important: cloud agents are strongest when the slice is already bounded and reviewable.

## Agents, Skills, And Prompts

### Custom agents

Custom agents should exist mainly where role boundaries matter.

- `dev-agent` stays the default implementation agent for coding work.
- `explorer-planner` should stay read-only and focus on planning, readiness, and slice preparation.

### Skills

Skills should carry the reusable workflow knowledge because they are portable.

- `explorer-planning` should help keep the PRD, tech spec, readiness checklist, and worklog aligned.
- `explorer-tech-research` should structure external research such as mapping or vendor evaluation.

### Prompts

Prompts should remain narrow and convenient.

- `draft-explorer-issue` should convert a stable worklog item into a usable GitHub issue draft.

## Recommended Workflow

### 1. Planning and readiness in VS Code

- Review the source-of-truth docs.
- Update the readiness checklist.
- Update the worklog.
- Choose one bounded slice.

### 2. Slice preparation in VS Code

- Use the planning agent or planning skill to produce an implementation brief.
- Confirm which checklist items still block the slice.
- Confirm the expected tests and docs.

### 3. Local implementation in VS Code

- Confirm the current branch is the correct Explorer feature branch.
- If it is not, switch back to updated `main`, create a dedicated branch for the approved slice, and only then continue.
- Hand off to `dev-agent` for coding work.
- Run local validation.
- Update docs if the slice changes visible behavior or planning state.

### Slice completion discipline

- If an approved implementation slice only requires narrow planning-state maintenance, such as marking the slice complete, updating the recommended next slice, or aligning readiness wording with merged code, the implementation PR should include those planning doc edits before it is considered done.
- Hand back to `explorer-planner` when closing the slice requires new product decisions, broader readiness re-evaluation, or reshaping later slice boundaries rather than simply recording the completed state.
- This keeps implementation PRs from leaving stale planning guidance behind while still reserving real planning work for the planning agent.

### 4. CLI support if needed

- Use Copilot CLI for shell-heavy support while running commands or interpreting failures.

### 5. Optional cloud-agent follow-up

- Use a cloud agent only for a narrow, approved task that is suitable for PR review.
- Review the PR locally in VS Code before treating it as complete.

## Repo Execution Rules To Preserve

- Respect the existing Node 24 requirement.
- Do not mix development and E2E databases.
- Keep Explorer additive to the current competition flows.
- Treat `VERSION` and `CHANGELOG.md` as final pre-commit bookkeeping for user-facing implementation commits, not planning updates.
- Do not let new planning assets replace the current repo instructions in `.github/copilot-instructions.md` and `AGENTS.md`.