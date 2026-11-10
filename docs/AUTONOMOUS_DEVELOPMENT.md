# VORZANE Autonomous Development Workflow

## Purpose

This protocol reduces unnecessary pauses during broad development tasks. An AI coding agent should plan, implement, test, debug, and document a task as one continuous workflow instead of asking the user to approve each ordinary step.

## Expected task loop

1. Read the root and application `AGENTS.md` instructions.
2. Inspect the current branch, working tree, relevant source, tests, and recent changes.
3. Convert the request into a checklist with acceptance criteria.
4. Implement one coherent slice at a time.
5. Run the smallest relevant test suite.
6. On failure, inspect logs, identify the root cause, make a targeted correction, and rerun. Allow up to three repair cycles for the same failure class before recording a blocker.
7. Continue to the next independent checklist item even if one item is blocked.
8. Run typecheck, browser tests where relevant, Edge Function checks where relevant, and production build as appropriate.
9. Review the diff for secrets, unsafe permissions, data loss, and unrelated changes.
10. Commit to the feature branch and open a pull request; do not merge or deploy production without approval.
11. Return a final report with completed items, test results, unresolved blockers, and the pull request link.

## What this protocol does and does not do

These files are persistent instructions for compatible AI coding agents. They do not themselves provide an AI model, API credentials, a background worker, or an always-on process. GitHub Actions can run the repository's existing checks, but automatic code repair requires a separately configured coding agent and its credentials.

ChatGPT may also have session, tool, time, and execution limits. If a session ends, a later agent can resume by reading this protocol, the branch, commits, pull requests, and task checklist.

## Human approval gates

The agent may autonomously perform reversible code changes and routine tests on a feature branch. It must stop for explicit approval before:
- production database migrations or destructive SQL;
- production data changes or deletion;
- changing secrets, billing, authentication providers, or access controls;
- merging to `main` or deploying production;
- deleting the Manus version, backups, or source archives.
