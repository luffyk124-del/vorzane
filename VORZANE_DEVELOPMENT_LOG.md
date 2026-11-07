# VORZANE Development Log

Updated: 2026-11-07

## Project Map

- `extracted-vorzane/VORZANE/app/`: Expo Router screens. The player flow includes login, migration/conflict resolution, and tabs for camp, expeditions, equipment, quests, and settings.
- `extracted-vorzane/VORZANE/src/game/`: client-side game state normalization, character stats, battle simulation, loot/catalog generation, equipment, quests, and expedition settlement.
- `extracted-vorzane/VORZANE/src/contexts/`: Supabase authentication and save synchronization, game state orchestration, and music playback.
- `extracted-vorzane/VORZANE/src/components/`: reusable UI, battle animation, account, profile, and save migration views.
- `extracted-vorzane/VORZANE/supabase/migrations/`: the `player_saves` JSONB table linked to `auth.users`; row-level policies constrain reads and writes to the authenticated owner.
- `extracted-vorzane/VORZANE/backend/`: separate Express/Prisma/MariaDB scaffold. It is not the active Pages backend.
- `extracted-vorzane/VORZANE/legacy/`: archived web implementation retained for compatibility/reference; it is not the current Expo application.
- `.github/workflows/pages.yml`: static Expo build and GitHub Pages deployment.

## System Status

| System | Evidence-based status |
| --- | --- |
| Web navigation and Arabic RTL screens | Implemented as Expo Router static routes; current export contains 15 routes. |
| Character creation and progression | Implemented in the client game engine. Four classes, levels, XP, and stat calculations exist. |
| Combat and dungeon | Implemented as client simulation with four modes, animated turns, rewards, and repeated dungeon battles. Results are not server-authoritative. |
| Equipment and economy | Starter shop, inventory, equipment slots, generated dungeon drops, player-only sale market, and pets exist client-side. Client state is not protected from a modified browser. |
| Quests and achievements | Finite quest/achievement catalog and one-time rewards exist. Daily/weekly rotations and server validation are not implemented. |
| Expeditions | Timed plans, queue, offline settlement, and summaries exist in client state. There is no trusted background worker. |
| Authentication | The active client calls Supabase email, anonymous, and Google OAuth flows. Google depends on external provider configuration; no live auth flow was exercised in this audit. |
| Save data | The client reads/upserts/deletes the signed-in player's `player_saves` row. RLS isolates player rows, but does not validate game rewards or prevent a player modifying their own JSON save. |
| Local/offline save | Per-player local cache and a conflict UI exist. A failed upsert previously failed to set the dirty marker, risking silent replacement by an older cloud save; this was fixed in this cycle. |
| FPS backend | Scaffold only. The client and server state paths differ, game commands return HTTP 501, account upgrade and Google linking are unfinished, and the client auth is still Supabase. Do not enable `EXPO_PUBLIC_GAME_API_URL` as a production service. |
| Multiplayer/social/live events | Not implemented. No real player-to-player market, guild, PvP, or event service is present. |
| GitHub Pages | Static web build works under `/vorzane/`. Pages can host the frontend but cannot run the Express backend. |

## Issues Found

- A Supabase save failure cached the local state but did not set `vorzane_offline_dirty_<userId>`. On a later load, a valid older cloud save could be preferred without presenting the existing conflict-resolution screen.
- Game rewards and all current game rules are calculated in the browser. RLS protects one player's row from another player; it does not make a player's own gold, inventory, XP, or battle result trustworthy.
- The FPS frontend integration is incomplete: no FPS auth provider is wired into `AuthContext`, `/api/v1/game/state` does not match the backend's `/api/state`, and `/api/v1/game/command` is a stub returning 501.
- Google OAuth requires provider credentials and allowed redirect URLs in Supabase; the code alone does not prove that the configured project accepts them.
- The web entry bundle is about 1.1 MB before transfer compression in the current Expo export. Measure real compressed transfer and runtime before deciding on code splitting.
- No Playwright package or browser executable was found in the workspace/container during this cycle, so an interactive browser/console/network test was not performed.

## Changes and Test Results

### 2026-11-07: Preserve unsynchronized local saves

- Extracted offline dirty-marker operations into `src/lib/offlineSaveMarker.ts`; use `localStorage` on web and `AsyncStorage` on native. Each pending save gets a token, operations are serialized per player, and a successful older upsert cannot clear a newer pending marker. Clear only the matching marker after a successful sync; confirmed account reset can explicitly clear it.
- Added deterministic tests for per-player marker persistence, token-safe clearing during overlapping saves, storage errors, one-time quest rewards, rejecting unknown shop items, dungeon battle reward/loot, and one-time expedition settlement.
- Added `tsx` as a development-only test runner; `pnpm-workspace.yaml` allows the `esbuild` build script required by it and no other package build scripts.
- `pnpm test`: 7 tests passed.
- `pnpm run typecheck`: passed.
- A direct compiled game-engine smoke test passed for character creation, battle sequence, reward/loot on victory, expedition settlement, one-time quest reward, and rejecting a non-catalog item.
- `EXPO_PUBLIC_BASE_PATH=/vorzane pnpm run build`: passed; 15 static routes exported.
- Local Expo Web preview returned HTTP 200 and rendered the VORZANE HTML shell. The browser launcher opened the page, but no Playwright/browser automation was available for DOM interaction, responsive screenshots, or console/network inspection.
- No Supabase requests that write data, Prisma migrations, or database changes were performed. No environment files or secrets were read, deleted, or added.

## Prioritized Roadmap

### P0: Protect player progress and establish QA

- Expand automated tests around save failure, offline recovery, conflict resolution, save import/export, and account switching.
- Add deterministic tests for battle outcomes, loot eligibility, progression, quest claims, economy limits, and expedition queue/catch-up boundaries.
- Exercise Supabase login, guest signup, email confirmation, save read/write, and RLS behavior in a dedicated test account without touching production player data.
- Keep the client-only game clearly classified as single-player/trust-on-device until a verified authoritative backend exists.

### P1: Complete or safely isolate backend integration

- Decide whether Supabase remains the production save/auth backend or the FPS backend will be completed. Do not present the current scaffold as operational.
- If FPS is chosen, reconcile auth/session contracts and API routes, implement and test game commands, enforce ownership and game rules in server transactions, and add idempotency and rate-limit tests.
- Review backend configuration, secret handling, CORS, cookies, health checks, and Docker startup. Keep migrations separate from deployment until backup and rollback procedures are approved.

### P1: Verify player-facing workflows

- Add browser automation for mobile and desktop: auth states, hero creation, battle settlement, equipment/shop, quest claim, expedition return, settings, and save conflict/retry.
- Inspect browser console and network failures, and verify Pages deep links and OAuth redirect allowlists.
- Test accessible names, disabled/loading/error/success states, RTL layout, and narrow viewport overflow.

### P2: Improve progression and operations

- Add daily/weekly content only with persisted period keys and one-time server-validated claims if a trusted backend is available.
- Keep social, multiplayer, admin, and live-event features out of the shipped UI until real services, authorization, moderation, and operational support exist.
- Measure bundle transfer, startup time, memory, and image/audio loading; split or compress assets based on measurements.

## Remaining Verification Limits

- This log is based on source inspection, local compilation, and deterministic smoke checks. It is not proof of live Supabase configuration, production data correctness, or successful interactive browser play.
- The existing Manus deployment and Supabase project were not changed. Database migrations were not run.
- Work is ongoing; the roadmap is not a claim that the RPG is complete.