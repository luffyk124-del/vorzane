# VORZANE — Project Status

> Last updated: 2026-11-09
> Main branch: `main`
> Latest main documentation commit: this file's current revision on `main` (see GitHub file history for its SHA)
> Latest merged application commit: `039a73897c380f9cd947f2cdaa04f7fc51a5d8bf`

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

## Completed — server-side first-save initialization (2026-11-09)

- PR #18 merged into `main` as commit `c5759d5d18f661bb772391db4ab2f0f4add14f70` after all required CI checks passed.
- Added an authenticated `initialize-save` Edge Function that validates the caller JWT, returns an existing owner-scoped save unchanged, or creates a canonical fresh save on the server when none exists.
- The endpoint accepts an empty payload only; it never accepts a client-provided game-state snapshot. It uses the server-only service-role key for an insert with conflict-ignore semantics, then re-reads through the caller JWT/RLS to verify owner visibility.
- Integrated the new-account path in `GameContext`. Until the function is deployed, the existing compatibility fallback remains in place; existing local/legacy/offline recovery flows are unchanged.
- Added Deno tests for authentication, payload rejection, preserving existing saves, fresh initialization, RLS-scoped verification, and database failures.
- CI run `42575607077`: game tests, desktop/mobile browser tests, TypeScript, Deno Edge Function typecheck/tests, web export, Pages export verification, and isolated social DB tests all passed. Separate isolated social DB run `42575607143` also passed.
- Not deployed to Supabase production. No production schema or player-save rows were changed; Manus remains untouched.

## Remaining work

- GitHub Pages deployment for PR #13's merge commit was verified successful (workflow run `42527315821`).
- PR #15 (atomic command receipts plus `economy-command`) is merged as `a36ae7cad7f46feb17242f170fcc7227c72a8128`; its migration and command function are not deployed to production.
- PR #16 remains draft and unmerged; it is not part of the active implementation path. Do not merge it without a fresh reconciliation against current `main` and full review.
- Server authority is not complete: battle results are still client-computed and the generic full-save client upsert remains active. Do not enable the economy feature gate or revoke client writes until battle settlement, save initialization, import/migration, reset, offline progression, and every other save mutation are server-owned and tested.
- Continue reviewing and improving existing gameplay and application flows.
- Verify each change with relevant automated tests before merging.
- Review authentication, authorization, player data ownership, and server-side validation in the existing architecture.
- Review progression, rewards, inventory, and economy flows for integrity and abuse resistance. PR #16 wires a gated command path for several non-combat operations, but is not yet a complete anti-tampering boundary.
- Improve mobile usability and verify responsive behavior on real devices.
- Maintain clear release notes and deployment verification for each production update.
- The project owner explicitly authorized necessary production Supabase changes. Still back up/export where supported, review every migration, keep changes additive and reversible, verify against isolated/test data first, and never drop or overwrite player data as a shortcut.

## In progress — server-authoritative non-combat command expansion (2026-11-09)

- Created branch `feat/server-authority-command-expansion` from current `main` after leaving stale PR #16 untouched.
- Ported the server-side command validation and canonical state transitions from the reviewed PR #16 implementation into `economy-command`, together with its Deno tests. This expands the server handler for pet ownership/activation, hero creation and starter state, stat allocation, expeditions, quest/achievement/recurring rewards, report dismissal, settings, and character/profile appearance.
- The change is server-side only at this stage. It does not wire the client, change the feature gate, alter the `player_saves` RLS policies, deploy an Edge Function, run a migration, or change production player data.
- PR #19 merged into `main` as `039a73897c380f9cd947f2cdaa04f7fc51a5d8bf` after all checks passed on head `d4d2a996e67bdc789278d39ce331f52320591355` (workflow `42578020613`; separate social DB run `42578020638`). The server-side non-combat command expansion is not deployed, not wired to the client, and not enabled.
- PR #20 preparation: added an additive `player_save_recovery` quarantine migration, an authenticated `stage-save-recovery` Edge Function, Deno tests, an isolated SQL privacy/size test, and an explicit safe-import policy. This stores untrusted snapshots separately and never writes to `player_saves`. Not deployed or client-wired.
- Code review confirmed the handler authenticates the caller, reads only the caller's save, validates command payloads against canonical game rules, and commits through the atomic receipt RPC. The PR remains server-side only: no client wiring, feature-gate activation, migration, production deployment, RLS/Auth change, or player-save write.
- Important rollout dependency: reward commands that inspect battle counters must remain disabled until battle settlement is server-owned and generic client snapshot writes are removed. This PR does not complete save authority: autosave/full-snapshot writes, offline conflict resolution, legacy import, reset, and battle settlement remain client-owned/outstanding.

## Production audit — 2026-11-09

- Read-only verification confirms exactly three rows remain in public.player_saves. No rows were inserted, updated, or deleted during this audit.
- Supabase currently lists only the authenticated read-only game-state Edge Function as ACTIVE (v1, verify_jwt=true). initialize-save is merged in GitHub but not deployed; economy-command is also not deployed.
- Security Advisor reports 8 authenticated-executable SECURITY DEFINER RPCs in the social/profile feature set, anonymous-sign-in policy warnings on friend_requests, player_profiles, and player_saves, plus leaked-password protection disabled. These are review findings, not confirmed exploits. Existing policies target the authenticated role and use auth.uid() ownership/participant checks where applicable; anonymous Auth users can still carry the authenticated database role. Do not change these settings or policies without verifying the intended anonymous-account product behavior and testing social flows.
- No production schema, RLS policy, Auth setting, Edge Function, or player-save row was changed by this audit.


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
| 2026-11-09 | `c5759d5d18f661bb772391db4ab2f0f4add14f70` | PR #18 merged. New-player save initialization passed game/browser, TypeScript, Deno, web-export, and isolated DB CI. `initialize-save` is not yet deployed to production; no production player data changed. |
| 2026-11-09 | `039a73897c380f9cd947f2cdaa04f7fc51a5d8bf` | PR #19 squash-merged after all CI passed: workflow `42578020613` (game systems, desktop/mobile browser, TypeScript, Deno typecheck/tests, web export, Pages export verification, isolated social DB) and workflow `42578020638` (isolated social DB). Deployment job skipped; no Supabase deployment/migration, client wiring, feature enablement, RLS/Auth change, or player-save mutation. |

## Current recovery slice — PR #20 preparation (2026-11-09)

- Branch: `feat/stage-untrusted-save-recovery`.
- New migration: `20261109090000_create_player_save_recovery.sql` creates an owner-readable, server-write-only quarantine table with payload size and idempotency constraints.
- New Edge Function: `stage-save-recovery` verifies the caller, bounds the payload, stores the original JSON under a caller-scoped recovery key, and returns the existing record on retry without replacing it.
- Added Deno handler tests and SQL tests for owner isolation, forbidden client writes, duplicate keys, and oversized payloads.
- CI verification completed successfully on PR head `d491c471d5c3e2a6c1889086f7bdd15e1ab95bf7`: build/test workflow `42580700081` passed (game tests, desktop/mobile browser tests, TypeScript, Deno checks/tests, web export, Pages export); isolated social DB workflow `42580700088` passed. Deploy job was skipped.
- Review blocker addressed in the branch: a private database counter and `AFTER INSERT` trigger enforce a lifetime maximum of five staged records per owner through an atomic upsert. Duplicate recovery keys do not consume quota, quota rejection rolls back the staged row, and the counter internals are inaccessible to client roles and `service_role` directly. The Edge Function returns HTTP 429 when the limit is reached.
- Added isolated SQL coverage for the five-record cap and a CI concurrency test that submits eight simultaneous privileged inserts and requires exactly five successes, three rejections, and a counter/row total of five. Added Deno coverage for the 429 response. The dedicated social DB workflow is now extended to execute the migration, SQL privacy/quota tests, and concurrent privileged-insert test. The latest PR head is `ef4cae807fb59d24048aa8ceabfc7ae1e4e197c5`; its pull-request CI rerun is pending.
- PR #20 has been marked ready for review, but remains unmerged until the latest full CI passes and the final diff is checked.
- Client integration, restore/merge logic, production migration, and deployment remain out of scope. No production migration/function was deployed, no player-save row was changed, and Manus remains untouched.

## Update policy

After every meaningful development batch, update the relevant sections above with:
- What changed.
- Which files or features were affected.
- Tests actually run and their results.
- Commit SHA and deployment link, when available.
- Any remaining issue or follow-up task.
