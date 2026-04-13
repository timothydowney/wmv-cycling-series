# How Agents Should Use This Project

This file is intentionally brief. It exists to steer agent workflows toward the real shared instruction surfaces instead of duplicating them.

## Source Of Truth

- Use [AGENTS.md](./AGENTS.md) for commands, environments, branch discipline, and validation flow.
- Use [.github/copilot-instructions.md](./.github/copilot-instructions.md) for always-on repo rules, coding standards, and release bookkeeping.
- Use custom agents, prompts, and skills only for task-specific workflow guidance.

## Practical Rules

1. Before substantial work, check the current branch and move to updated `main` plus a dedicated feature branch if needed.
2. Prefer one-off validation commands over long-running background server workflows.
3. Use `npm run dev` and `npm run dev:cleanup` when a live dev server is actually required.
4. Do not invent package scripts or alternate process-management commands that the repo does not define.
5. If a customization file starts repeating command catalogs or environment tables, move that information back to [AGENTS.md](./AGENTS.md) and link to it.

