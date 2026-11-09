# Client Save Mutation Audit

Date: 2026-11-09  
Audited base: `main` at `65df6dfd65454cff53c331c4e5bb4ea4aaad8b53`

## Scope and conclusion

This is a source-only audit of client save mutation paths. It does not change runtime behavior, database schema, Edge Functions, production data, or deployment configuration.

The client is **not ready for server-authoritative cutover**. The current development branch replaces the blind whole-state upsert with an insert-only / version-conditional whole-state write, but the client still supplies the complete state and remains authoritative for many transitions. `resetPlayerSave` still deletes the row directly. The server-side command endpoint already implements a number of useful non-combat operations, but the current UI calls them through the generic `update` callback or bypasses them through full-state snapshot persistence.

No feature flag, RLS policy, client database privilege, production Edge Function, migration, player save, or Manus deployment was changed in this audit.

## Mutation inventory

| Client path | Current behavior | Server-side coverage in main | Cutover status / required work |
|---|---|---|---|
| Autosave / state effect | `GameContext.tsx`: delayed full-state write; development branch uses `insert` for an unknown row and `update` filtered by both `user_id` and the last observed `updated_at` | `economy-command` has typed commands for many individual operations | **Still a blocker.** Optimistic concurrency prevents stale sessions from blindly overwriting newer rows, but arbitrary client snapshots remain accepted. Replace generic snapshot persistence only after every mutation path has a typed command and conflict-safe client handling. |
| `flushNow`, logout/account transition flush | Flushes the latest full snapshot through `persistSnapshot` | No safe generic full-state replacement command | **Blocker.** Define explicit flush semantics; do not accept arbitrary client state as authoritative. |
| Offline cache / offline progress | Stores device cache and pending marker; local progress can later be reconciled | Recovery staging stores untrusted payloads in quarantine; it is not a restore/merge command | **Blocker.** Preserve local copy; add explicit user-reviewed recovery/merge flow and server validation before applying anything. |
| Cloud recovery / expedition progression | Loading may call `advanceExpeditions` and then persist the resulting snapshot | `advanceExpeditions` command exists | Replace snapshot write with the typed command; handle idempotency and stale versions. |
| Offline conflict resolution | `resolveMigration` can upload the chosen local or cloud snapshot | No server command for accepting a complete arbitrary snapshot | **Blocker.** Keep both copies until a validated restore/merge protocol exists. |
| Legacy save import | `resolveMigration` uploads the selected normalized legacy state | Quarantine staging exists, but no reviewed restore command | **Blocker.** Stage first, validate server-side, require explicit owner choice, and never delete the source copy before confirmed commit. |
| JSON import in Settings | `settings.tsx` calls `game.update(() => pendingImport)` | No reviewed import/replace command | **Blocker.** Must use quarantine + validated restore flow; never route arbitrary imported state through a generic command. |
| Save reset | `resetPlayerSave` directly calls `player_saves.delete` | `resetSave` now resets the existing row to canonical server-generated state | Command exists; **client is not wired**. Replace direct delete only after exact-head tests and client error/retry handling. |
| Expedition start | `expeditions.tsx` calls generic `update` after `beginOrQueueExpedition` | `beginExpedition` command exists | Candidate for isolated typed-command wiring. |
| Expedition completion / reports | Expedition clock can advance local state; report dismissal uses `clearReport` / generic update | `advanceExpeditions` and `dismissReport` commands exist | Candidate for isolated typed-command wiring; verify server time, retry behavior, and report idempotency. |
| Gear / pet purchases and equipment | `gear.tsx` calls generic `update` for buy/sell/equip/unequip/pet changes | Typed commands already exist in `economy-command` | Existing PR #16 is not a safe wholesale merge. Reconcile only reviewed callsites against current main. |
| Recurring missions / quest rewards | `quests.tsx` calls generic `update` for recurring mission, quest, expedition task, and exploration achievement claims | Matching claim commands exist | Candidate for isolated typed-command wiring. `ensureMissionPeriods` is a separate client mutation and has no corresponding command yet. |
| Profile appearance | `profile.tsx` uses generic `update` for character style fields | `updateCharacterStyle` command validates a complete style object | Candidate for typed-command wiring; send a validated full style value and avoid accepting unknown keys. |
| Profile avatar / settings | `settings.tsx` uses generic `update` for avatar and audio settings | `setProfileAvatar` and `updateSettings` commands exist | Candidate for typed-command wiring; validate settings keys and bounds server-side. |
| Battle settlement / battle-derived rewards and stat progression | Battle screens settle a returned state through generic `update`; home also includes initial starter-state setup and stat allocation | Some stat and claim commands exist, but battle settlement is a separate high-risk state transition | Explicitly out of scope for this non-combat audit and cutover slice. Do not alter battle/combat behavior as part of this work. |

## Callsite map reviewed

- `src/contexts/GameContext.tsx`: `persistSnapshot`, autosave effect, `flushNow`, `resolveMigration`, `resetPlayerSave`, `clearReport`, and cache/offline marker flows.
- `app/(tabs)/expeditions.tsx`: expedition start and report dismissal.
- `app/(tabs)/gear.tsx`: item/pet purchase, sale, equip, unequip, and activation.
- `app/(tabs)/quests.tsx`: mission-period initialization, recurring claims, quest claims, expedition-task claims, exploration-achievement claims, and a separate battle-settlement callback.
- `app/(tabs)/profile.tsx`: character-style updates.
- `app/(tabs)/settings.tsx`: settings, profile avatar, JSON import, reset UI, and retry/export actions.
- `app/(tabs)/home.tsx`: starter-state setup, stat allocation, and battle settlement; battle-related state transitions are excluded from this slice.
- `src/components/MigrationScreen.tsx`: migration UI delegates to `GameContext.resolveMigration`; the actual write remains in the context.

## Recommended safe implementation order

1. Add a typed client command transport with command IDs, expected save version, authenticated invocation, strict response validation, retry/replay handling, and stale-version UX. Keep it disabled by default.
2. Wire one low-risk non-combat slice at a time: settings/profile appearance, report dismissal, expedition start/progression, then reward claims. Keep local cache until the server confirms each commit.
3. Add a server-owned mission-period transition for `ensureMissionPeriods`; do not silently keep this as a generic client write.
4. Implement the client reset path using the existing `resetSave` command; verify the row remains present and becomes canonical fresh state.
5. Design validated import/recovery separately: quarantine untrusted source, explicit owner selection, server validation, version check, atomic commit, and retain the original local/quarantine copy until confirmation.
6. Only after all mutation paths are accounted for and tested may generic `player_saves.upsert` be removed and client write privileges be reconsidered.

## Required verification before any cutover

- Unit tests for every command's domain rules and malformed/extra payload rejection.
- Deno tests for auth, owner scoping, idempotent replay, stale version conflicts, and atomic commits.
- Isolated PostgreSQL tests for receipt uniqueness, ownership, and concurrent commands.
- Browser tests for desktop and mobile, including offline cache preservation, retry, account switching, reset, import, and conflict resolution.
- TypeScript, Deno typecheck/tests, game tests, web export, and Pages export checks on the exact PR head.
- No production migration, Edge Function deployment, RLS/Auth change, feature-flag enablement, or player-save mutation without a separate explicit approval and verified rollback plan.

## Explicit exclusions

- Do not merge PR #16 as-is; it is stale/diverged and still contains generic snapshot upsert and direct-delete reset behavior.
- Do not enable `SERVER_ECONOMY_COMMANDS_ENABLED` or revoke client writes while any generic save mutation path remains.
- Do not deploy Supabase production migrations/functions or mutate existing player saves as part of this audit.
- Preserve the original Manus deployment.
- No battle/combat feature work is included in this non-combat save-lifecycle slice.

## Conditional client snapshot protection — development branch

- Branch: `feat/conflict-safe-cloud-save` (based on current `main`).
- Replaces the unconditional client `upsert` with insert-only behavior when no cloud row/version is known, and an update guarded by both `user_id` and the exact previously observed `updated_at` when a row exists.
- A uniqueness collision on first insert or an update returning no row is treated as a version conflict. Permission/network errors remain ordinary failures and are not mislabeled as conflicts.
- On conflict, the client preserves its local cache and pending marker, pauses further cloud writes, fetches the latest cloud copy, and exposes the existing local/cloud conflict-resolution UI when both copies are available.
- New versions are monotonic relative to the observed version, avoiding a same-millisecond update that would leave the concurrency token unchanged.
- This is a **client-side optimistic-concurrency safeguard**, not server authority: it does not validate game rules, remove client snapshot writes, change RLS, alter schema, deploy functions, or mutate production data. It must pass exact-head CI and review before merge.
