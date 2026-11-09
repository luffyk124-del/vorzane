# VORZANE — Project Status

> Last updated: 2026-11-09
> Main branch: `main`
> Latest main documentation commit: `6d546b2ca5c764bee8d847db0c3d91645a328d9d`
> Latest merged application commit: `741126b48c0831f2353987d7cc94267f7e52f15b`

This file records the actual state of the VORZANE project. Update it after each meaningful implementation, test result, deployment, or blocker. Only mark work complete when supported by verification.

## Current state

- The web application is deployed on GitHub Pages.
- The original Manus version is preserved and has not been modified.
- The existing Supabase project remains the application's database. Production audit confirmed three player-save rows, RLS enabled on the three public game/social tables, and no economy-command migration applied.
- Deployed the authenticated read-only `game-state` Edge Function to production (version 1, `verify_jwt=true`). The function forwards the caller JWT and queries only that caller's save under existing RLS. No database migration or player-data write was performed.
- Development continues from the existing application and its current architecture.

## Completed work

- Extracted 70 project files into `extracted-vorzane/VORZANE/` and committed them to GitHub.
- Merged the previously completed player social/friends functionality and related notification work.
- Added an original SVG fantasy character preview.
- Connected character appearance selections to the character preview.
- Updated browser tests for character preview and appearance controls.
- Merged PR #6 (character customization and 2D model preview) after all CI checks passed: desktop/mobile browser flows, game-system tests, TypeScript, Supabase Edge Function checks/tests, web export, and isolated social DB tests. Merge commit: `cdc25cc64d941276ca9e8f03de6bd316f5b77738`.
- Merged PR #9 (save-data integrity and ownership protections) in commit `004ac127d3b661982de88058743983cd3b862b57`.
- Merged PR #10 (server-authority design for progression, rewards, and combat outcomes) in commit `3d6598a9ffd4fc011410adb0e2958f493191cc09`.
- Merged PR #11 (authenticated, read-only game-state Edge Function) in commit `a507b530f77f806c9330324aa113c9d25d3ae902`; its dedicated Deno checks and tests passed.
- Fixed the character page import issue and friends-page database mock behavior in browser tests.
- Fixed duplicated character creator controls on the new-hero screen: removed the duplicate preview, gender selector, and appearance options.
- Added a mobile browser regression test that signs into an empty account and asserts the new-hero creator controls each render exactly once.
- Merged PR #12 after all CI checks passed (game-system tests, desktop/mobile browser flows, TypeScript, Supabase Edge Function checks/tests, web export, and isolated social DB tests). Merge commit: `d84a3cb6ec3e1310415b54d53853b86ea4fcb48a`.
- Fixed duplicated hero-creator UI on the new-player screen: the character preview, character choice, and appearance controls now render once. Added a mobile browser regression test for a fresh account. PR #12 merged as `d84a3cb6ec3e1310415b54d53853b86ea4fcb48a`; game-system, desktop/mobile browser, TypeScript, Edge Function, web export, and isolated social DB checks passed.
- Merged PR #13: prevented unequipping gear when the 500-item inventory limit is reached; added engine regression coverage and disabled the UI action while full. Merge commit: `43a65774f81ac88b6ba941cf962ef0e39cd43c26`.
- GitHub Pages deployment succeeded for commit `3ddb226a59f78356038180575e7641e02648a981`.
- Merged PR #14 (`Use authenticated game-state read endpoint`) as `741126b48c0831f2353987d7cc94267f7e52f15b`. Its compatibility fallback remains in place.

## Current links

- Repository: https://github.com/luffyk124-del/vorzane
- Live web application: https://luffyk124-del.github.io/vorzane/
- Preserved Manus version: https://vorzane-ebvt9uxg.manus.space/home

## Remaining work

- GitHub Pages deployment for PR #13's merge commit was verified successful (workflow run `42527315821`).
- PR #15 (atomic command receipts plus `economy-command`) is merged as `a36ae7cad7f46feb17242f170fcc7227c72a8128`; its migration and command function are not deployed to production.
- PR #16 remains draft and unmerged: https://github.com/luffyk124-del/vorzane/pull/16. Last inspected head was `80b90be86ed6b8a6874d17166314c55d99276194`; comparison against then-current `main` showed 38 commits ahead and 2 behind. Re-fetch the PR head and CI before acting; prior CI does not validate newer commits.
- Server authority is not complete: battle results are still client-computed and the generic full-save client upsert remains active. Do not enable the economy feature gate or revoke client writes until battle settlement, save initialization, import/migration, reset, offline progression, and every other save mutation are server-owned and tested.
- Continue reviewing and improving existing gameplay and application flows.
- Verify each change with relevant automated tests before merging.
- Review authentication, authorization, player data ownership, and server-side validation in the existing architecture.
- Review progression, rewards, inventory, and economy flows for integrity and abuse resistance. PR #16 wires a gated command path for several non-combat operations, but is not yet a complete anti-tampering boundary.
- Improve mobile usability and verify responsive behavior on real devices.
- Maintain clear release notes and deployment verification for each production update.
- The project owner explicitly authorized necessary production Supabase changes. Still back up/export where supported, review every migration, keep changes additive and reversible, verify against isolated/test data first, and never drop or overwrite player data as a shortcut.

## Replit handoff — current work order

The project owner authorized continued VORZANE development, including necessary production Supabase changes. Continue from the latest `main`; do not assume prior CI applies to newer commits.

1. Re-fetch `main`, PR #16, its source branch, and latest GitHub Actions runs. Reconcile the branch with current `main` without overwriting newer changes.
2. Complete server-authoritative gameplay before enabling `SERVER_ECONOMY_COMMANDS_ENABLED`: move battle generation and settlement to a server command; client only animates a sanitized display sequence and never submits `result.state`; remove generic client `player_saves` snapshot upserts and pre-command full snapshot flush; implement safe server-side first-save initialization; review import/migration, save reset, offline progression, autosave, mission-period updates, and every other save mutation.
3. Add tests for ownership, validation, replay/idempotency, stale versions, malformed payloads, and battle reward/state integrity. Run game tests, desktop/mobile browser tests, TypeScript, Deno Edge Function checks/tests, web export, and isolated DB tests.
4. Only after client write paths are removed and all mutations are server-owned, apply reviewed additive production migrations and deploy required Edge Functions. Verify deployed versions, JWT settings, RLS behavior, and authenticated read/write flows with a test account before enabling the feature gate.
5. Never expose service-role credentials to the client, commit secrets, or delete/reset existing player saves. Preserve the Manus deployment untouched.
6. Update this file after each meaningful batch with exact commits, test runs, deployment versions, and blockers. Merge and publish only after relevant checks pass.

Production Supabase project ref: `incidgigfqyjbqfegukg`. The authenticated read-only `game-state` Edge Function is active (v1, `verify_jwt=true`). The `economy-command` function and receipt migration from PR #15 are not deployed. Three existing player-save rows were observed during the last audit; preserve them.

## Project safety rules

- Preserve the original Manus version unless the project owner explicitly requests a change.
- Do not perform destructive operations on the existing Supabase project.
- Production migrations and Edge Function deployments are permitted under the project owner's explicit authorization; keep changes additive, tested, and reversible.
- Never commit real credentials, tokens, or private keys.
- Do not claim a feature or deployment is complete without test or deployment evidence.
- Keep a verified rollback path for production changes.

## Verification log

| Date | Commit | Verification |
|---|---|---|
| 2026-11-08 | `3ddb226a59f78356038180575e7641e02648a981` | Desktop/mobile browser flows, TypeScript checks, web build, isolated social DB tests, and GitHub Pages deployment passed. |
| 2026-11-08 | `004ac127d3b661982de88058743983cd3b862b57` | PR #9 merged: isolated PostgreSQL ownership and save-size validation checks passed. |
| 2026-11-08 | `3d6598a9ffd4fc011410adb0e2958f493191cc09` | PR #10 merged: server-authority architecture specification; documentation-only change. |
| 2026-11-08 | `a507b530f77f806c9330324aa113c9d25d3ae902` | PR #11 merged: authenticated read-only game-state function; Deno typecheck and tests passed. |
| 2026-11-08 | `cdc25cc64d941276ca9e8f03de6bd316f5b77738` | PR #6 merged: game tests, desktop/mobile browser flows, TypeScript, Edge Function checks/tests, web build, and social DB tests passed. |
| 2026-11-08 | `d84a3cb6ec3e1310415b54d53853b86ea4fcb48a` | PR #12 merged: duplicate new-hero creator controls removed; fresh-account mobile browser regression test, game tests, TypeScript, Edge Function checks/tests, web export, and social DB tests passed. |
| 2026-11-09 | `741126b48c0831f2353987d7cc94267f7e52f15b` | PR #14 merged. Production `game-state` Edge Function deployed and confirmed ACTIVE v1 with JWT verification enabled; production migration history unchanged. |

## Update policy

After every meaningful development batch, update the relevant sections above with:
- What changed.
- Which files or features were affected.
- Tests actually run and their results.
- Commit SHA and deployment link, when available.
- Any remaining issue or follow-up task.
