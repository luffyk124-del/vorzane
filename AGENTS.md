# VORZANE Autonomous Development Instructions

These instructions apply to AI coding agents working in this repository.

## Execution policy

- When given a concrete development task, inspect the current repository state and relevant code before changing anything.
- Break broad tasks into a checklist of independently verifiable work items. Execute the checklist in order without asking for confirmation between ordinary implementation, test, debugging, refactoring, and documentation steps.
- Continue after each successful check to the next unfinished item. Do not stop merely to report progress.
- Run the relevant checks after each meaningful change. If a check fails, inspect the failure, fix the underlying issue, and rerun the check. Repeat within a bounded retry budget of 3 repair cycles per failure class.
- If a failure cannot be fixed safely within that budget, record the exact error, attempted fixes, and remaining blocker; continue with independent tasks that are not blocked.
- Before finishing, run the broadest practical verification suite and produce a concise report of completed work, changed files, checks run, failures, and deployment status.
- Do not claim a test, build, deployment, or external operation succeeded unless its result was observed.

## Autonomy boundaries

Proceed without asking the user for routine implementation decisions when a safe, reversible default exists. Ask only when:
- a decision is destructive or difficult to reverse;
- production data, credentials, billing, user access, or external users may be affected;
- a required secret, account permission, external service, or product decision is unavailable;
- requirements materially conflict or the intended outcome cannot be inferred.

Never bypass a permission boundary or approval gate to preserve momentum.

## Repository and production safety

- Work on a dedicated feature branch; never commit directly to `main`.
- Preserve the Manus version and all source snapshots/backups.
- Supabase is the existing backend. Do not replace the project or change its project ID.
- Never run migrations, destructive SQL, schema resets, bulk data updates, or production writes without explicit approval. Prefer isolated local/test PostgreSQL for migration and RLS tests.
- Never expose service-role keys, access tokens, database URLs, or other secrets in client code, logs, commits, or artifacts.
- Do not merge or deploy to production automatically. Open a pull request and report the verification results.
- Keep changes additive and backward-compatible unless the task explicitly authorizes a breaking change.

## Definition of done

A task is done only when:
1. the requested behavior is implemented or a concrete blocker is documented;
2. relevant automated tests pass, or failures are explicitly reported;
3. typecheck and build pass when applicable;
4. security, privacy, and data-integrity implications are reviewed;
5. documentation and the final report match the actual changes.
