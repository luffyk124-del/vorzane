# VORZANE — Project Status

> Last updated: 2026-11-09
> Main branch: `main`
> Latest merged application commit: `a36ae7cad7f46feb17242f170fcc7227c72a8128`
> Latest deployment verification: GitHub Pages deployment for main commit `a36ae7cad7f46feb17242f170fcc7227c72a8128` succeeded in workflow `42531072074`.

This file records the actual state of the VORZANE project. Update it after each meaningful implementation, test result, deployment, or blocker. Only mark work complete when supported by verification.

## Current state

- The web application is deployed on GitHub Pages.
- The original Manus version is preserved and has not been modified.
- The existing Supabase project remains the application's database; no production migration or destructive database change was performed as part of the recent work.
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
- Merged PR #15 (`a36ae7cad7f46feb17242f170fcc7227c72a8128`): added the additive player command receipt SQL migration, atomic idempotent `commit_player_command` RPC, and authenticated `economy-command` Edge Function for buy/sell/equip/unequip. The TypeScript fixture typing error was fixed in commit `2b02b5a9d28783b0570d2fd24d70d9632a1a3a90`; all PR checks passed before merge, including game tests, desktop/mobile browser tests, TypeScript, Edge Function checks/tests, web export, and isolated social DB tests.
- PR #16 (`feat/wire-server-economy-commands`) now has passing CI run `42533861358`: game systems, desktop/mobile browser flows, TypeScript, Supabase Edge Function typecheck/tests, web export, and isolated DB tests all passed. The feature gate remains `false`; no production deployment occurred.
- Continued PR #16 with server-backed pet purchase and activation commands (`buyPet`, `setPet`) using the existing canonical engine and atomic receipt RPC. Added Edge Function tests for canonical pet pricing, ownership, and level eligibility. These changes are pending a fresh CI run.
- GitHub Pages deployment succeeded for the PR #15 merge commit `a36ae7cad7f46feb17242f170fcc7227c72a8128` in workflow `42531072074` (build, browser tests, export verification, and deploy all succeeded).
- PR #16 CI initially exposed a browser-test mock mismatch: the save path requests the returned `updated_at` row, while the mock returned HTTP 204. Commit `d0e508479ffe0b836d3fa7851c2907ba748298e7` corrected the mock; follow-up CI run `42533861358` passed all required jobs.

## Current links

- Repository: https://github.com/luffyk124-del/vorzane
- Live web application: https://luffyk124-del.github.io/vorzane/
- Preserved Manus version: https://vorzane-ebvt9uxg.manus.space/home

## Remaining work

- GitHub Pages deployment for PR #13's merge commit was verified successful (workflow run `42527315821`).
- Main deployment for PR #15 merge commit `a36ae7cad7f46feb17242f170fcc7227c72a8128` is verified successful (workflow `42531072074`).
- Complete end-to-end review and fresh CI verification for the expanded draft PR #16, including pet commands and command retry/conflict behavior.
- Keep the server economy feature flag disabled until the additive receipt migration and Edge Function are separately reviewed and explicitly approved for production deployment.
- Integrate server-backed commands for all remaining save mutations before considering any client-write privilege revocation. The existing client upsert path remains active and must not be mistaken for server-authoritative security.
- Continue reviewing and improving existing gameplay and application flows.
- Verify each change with relevant automated tests before merging.
- Review authentication, authorization, player data ownership, and server-side validation in the existing architecture.
- Review progression, rewards, inventory, and economy flows for integrity and abuse resistance. PR #15 provides server-side buy/sell/equip/unequip rules; PR #16 begins the client wiring but remains draft and feature-gated off.
- Improve mobile usability and verify responsive behavior on real devices.
- Maintain clear release notes and deployment verification for each production update.
- Keep database changes additive, reviewed, backed up, and reversible; do not run production migrations without explicit approval.

## Project safety rules

- Preserve the original Manus version unless the project owner explicitly requests a change.
- Do not perform destructive operations on the existing Supabase project.
- Do not run production database migrations without explicit approval.
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
| 2026-11-08 | `a36ae7cad7f46feb17242f170fcc7227c72a8128` | PR #15 merged after all PR checks passed. Main-branch browser tests, build/export verification, isolated social DB tests, and GitHub Pages deployment also passed in workflow `42531072074`. |
| 2026-11-08 | `c3bb54cf1b4b5734d933d12f0fd0233cb98fbcc7` | PR #16 draft: gated client command path added; feature flag remains off; CI and end-to-end review pending. |
| 2026-11-09 | `d0e508479ffe0b836d3fa7851c2907ba748298e7` | Updated the browser-test Supabase mock to return `updated_at`; PR #16 CI run `42533861358` passed all required jobs. |
| 2026-11-09 | Pending | Added server-backed `buyPet` and `setPet` commands plus canonical-rule tests to PR #16; fresh CI pending. |

## Update policy

After every meaningful development batch, update the relevant sections above with:
- What changed.
- Which files or features were affected.
- Tests actually run and their results.
- Commit SHA and deployment link, when available.
- Any remaining issue or follow-up task.
