# VORZANE — Project Status

> Last updated: 2026-11-08 21:40 (Europe/Madrid)
> Status owner: project development log
> Active backend branch: `feature/fps-backend-foundation`
> Active pull request: [#8 — FPS.ms backend foundation](https://github.com/luffyk124-del/vorzane/pull/8)

This file is the running source of truth for completed work, current work, verification, and remaining tasks. Update it whenever a meaningful project change is made.

## Overall status

- **Current playable web app:** deployed on GitHub Pages.
- **FPS.ms migration:** in progress; not deployed and not yet connected to the frontend.
- **Manus original:** preserved; no changes made.
- **Production Supabase:** preserved; no production migrations or destructive changes made.

## Completed

### Main application

- Extracted 70 project files into `extracted-vorzane/VORZANE/` and committed them to GitHub.
- Existing social features were merged previously: player social/friends functionality and related notifications schema work.
- Replaced the earlier character preview with an original SVG fantasy character presentation.
- Connected character appearance choices (class, gender, skin tone, hairstyle, face, outfit, and body) to the preview.
- Updated browser tests for the fantasy character preview and appearance controls.
- Fixed navigation/test synchronization issues affecting desktop and mobile browser flows.
- Fixed the character page import issue and corrected the friends-page database mock behavior in browser tests.
- Latest verified main application commit: `3ddb226a59f78356038180575e7641e02648a981`.
- GitHub Pages deployment for that main commit succeeded: [workflow run #42496279671](https://github.com/luffyk124-del/vorzane/actions/runs/42496279671).
- Live web app: https://luffyk124-del.github.io/vorzane/

### FPS.ms backend foundation — PR #8

Added on branch `feature/fps-backend-foundation`:

- `backend/package.json`: isolated Node.js backend package.
- `backend/tsconfig.json`: strict TypeScript build configuration.
- `backend/.env.example`: documented environment variable template; contains no real secrets.
- `backend/src/server.ts`: Express service with Helmet, explicit CORS allow-list, bounded JSON body parsing, startup environment validation, and `GET /healthz`.
- `backend/README.md`: setup notes and explicit scope limitations.
- CI workflow updated to run backend typecheck/build when backend files change.

## Current work

### PR #8 — FPS.ms backend foundation

- PR: https://github.com/luffyk124-del/vorzane/pull/8
- Branch: `feature/fps-backend-foundation`
- Head commit at last recorded check: `08e3f0a7c75934c41399bf3aa729239360903731`
- PR remains open and is intentionally marked draft.
- Checks for that commit: `backend-check` passed, `build` passed, and `social-db` passed.
- GitHub Pages deploy job was skipped for the pull request, as intended; this is not a failed build.
- Do not merge until the architecture and next migration steps are reviewed.

## Remaining work

1. Confirm FPS.ms account capabilities, supported Node.js version, deployment/start command, environment variable handling, ports, TLS, logs, and backup/restore options.
2. Design authentication and secure session handling; do not switch the frontend until the complete flow is tested.
3. Design the MariaDB schema and Prisma data model. Review relationships, indexes, constraints, and migration/rollback strategy before applying anything.
4. Implement persistence and a safe, resumable data import plan. Define validation, duplicate handling, backups, reconciliation, and rollback before moving player data.
5. Move authoritative game operations to the backend, including progression, rewards, inventory/economy, quests, and other state-changing actions. Do not trust client-submitted reward or currency values.
6. Add background jobs and real-time communication only where required by verified game features.
7. Integrate the frontend with the new API behind a controlled transition; retain a safe rollback path.
8. Add automated tests for authentication, authorization, data ownership, progression/reward integrity, rate limits, and failure recovery.
9. Deploy a staging instance on FPS.ms, run end-to-end tests, verify backups and restore, then plan production cutover.
10. Verify the final deployment and update this file with the deployed URL, commit, and test evidence.

## Explicitly out of scope until separately designed and verified

- No production Supabase migrations or schema changes without explicit approval.
- No destructive database operations or automatic data deletion.
- No changes to the original Manus project.
- No frontend/auth cutover to the new backend until end-to-end tests pass.
- No claims that FPS.ms deployment, MariaDB persistence, multiplayer, WebSockets, or production migration are complete until implemented and verified.

## Verification record

| Date | Commit / reference | Result |
|---|---|---|
| 2026-11-08 | `3ddb226a59f78356038180575e7641e02648a981` | Main app browser tests, typecheck, web build, isolated social DB tests, and GitHub Pages deployment passed. |
| 2026-11-08 | `08e3f0a7c75934c41399bf3aa729239360903731` | Backend typecheck/build, app build/browser tests, and isolated social DB checks passed; Pages deploy skipped for PR. |

## Update rules

- Update this file after each meaningful implementation, test result, deployment, or blocker.
- Record exact commit hashes and workflow/PR links where available.
- Keep completed, in-progress, and planned work clearly separated.
- Never label a task complete based only on code being written; require successful tests or deployment evidence.
