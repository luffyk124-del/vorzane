# Server authority spec: gold, level, rewards

Status: APPROVED FOR IMPLEMENTATION — staged rollout; production cutover requires separate verification and explicit approval.
Scope: protect currency, progression and reward values from client tampering.

## Problem

`player_saves.game_state` is written by the client as a full JSON object. RLS isolates players from each other, but a player can write any gold, level, or item value into their own save. The client-side game engine (src/game) computes rewards, so rewards are not trustworthy.

## Target design

The client sends commands, not state. The server validates each command, applies the rule, and writes the new state.

- Commands already exist in `shared/contracts/game.ts` (`GameCommand`): createHero, startBattle, claimQuest, buyItem, sellItem, equipItem, unequipItem, buyPet, setPet, beginExpedition, updateSettings, setProfileAvatar, dismissReport.
- Server runtime: Supabase Edge Function (same project, no new host). It uses the service role internally and checks `auth.uid()` on every call.
- Storage: `player_saves` stays the store. Clients get read-only access through the function; direct writes from clients are revoked once the cutover is done.

## Rollout slices (each one shippable and reversible)

1. **Read path**: function returns current save for the caller. No behavior change.
2. **Economy commands**: buyItem, sellItem, equipItem, unequipItem. Server validates prices, ownership, and level requirements.
3. **Rewards**: startBattle and claimQuest. Server computes rewards from the rules, client only displays them.
4. **Progression**: level and XP updated only by server results.
5. **Cutover**: revoke client update on `player_saves`, keep a feature flag to roll back to the old save path.

Each slice needs tests: rejected invalid command, rejected command for another user's save, and a replay check.

## Decisions

- **Runtime:** Supabase Edge Functions are the chosen server runtime. This keeps the existing Supabase project and database; it does not authorize production schema changes or deployment by itself.
- **Battle verification:** Never trust a client-submitted win, reward, damage log, or resulting state. The server will recompute battle outcomes from a server-issued battle seed and the canonical game rules. The client may submit only the battle identifier and player actions or inputs that are part of the game contract.
- **Randomness and replay:** Use a deterministic, versioned PRNG for battle resolution and server-generated IDs and timestamps for drops and receipts. A command ID is idempotent: replaying it returns the recorded result and never grants rewards twice.
- **Implementation order:** (1) read-only state endpoint and contract tests; (2) economy and inventory commands; (3) battle and quest reward validation; (4) progression and expedition completion; (5) client-write cutover only after every supported write path is server-backed and tested.
- **Compatibility:** Keep the existing `player_saves` table and save JSON shape during the initial rollout. Migrations, if later needed, must be additive, tested against a disposable or local database first, reversible where possible, and separately approved before production application.

## Current mutation-path audit (2026-11-09)

The first-save initialization slice is merged in PR #18 (c5759d5d18f661bb772391db4ab2f0f4add14f70), but is not deployed. The following paths remain client-owned in src/contexts/GameContext.tsx and must be handled before client write privileges can be revoked:

| Path | Current behavior | Required server-side treatment |
|---|---|---|
| persistSnapshot | Direct client player_saves.upsert of a full GameState; used by autosave and flushNow. | Replace with typed commands / server-validated transitions. Do not accept arbitrary full snapshots. |
| Offline progression | advanceExpeditions runs on client load and can award gold, XP, completion counts, and reports. | Server calculates elapsed completions from persisted expedition timestamps and canonical rules; client only renders the result. |
| Offline conflict resolution | resolveMigration can write either local or cloud snapshot through persistSnapshot. | Preserve both copies until a validated, explicit resolution is accepted. A local snapshot is untrusted input and must not be allowed to set currency, levels, inventory, or rewards. |
| Legacy import / fresh choice | resolveMigration writes an imported legacy snapshot or a fresh snapshot directly. | One-time, owner-scoped import with schema validation and server-side sanitization; never overwrite an existing cloud row. Define an explicit policy for legacy economic/progression fields before implementation. |
| Reset | resetPlayerSave directly deletes the caller's player_saves row. | Do not deploy a delete-based reset. Keep the row and design a recoverable, explicit reset flow only after backup/restore semantics are defined. |
| First account initialization | initialize-save creates canonical server state for an account with no cloud row. | Merged and CI-tested; deploy only after the remaining client write paths and rollout safeguards are reviewed. The compatibility fallback still exists. |

### Required cutover gates

1. No client code may call player_saves.upsert, update, or delete for game-state mutations.
2. Server commands must own expedition completion, mission-period rollover, reward claims, and every progression/economy mutation—not merely the shop commands.
3. Save recovery/import must not trust client-supplied economic or progression values.
4. Reset must preserve an auditable recovery path and must never delete the player's only save row.
5. Add tests for concurrency, duplicate command replay, stale versions, cross-user access, malformed payloads, offline time boundaries, and failure recovery.
6. Only after all gates pass may the production migration revoke direct client writes. Keep the current compatibility path until then.

## Not in this spec

- Multiplayer, clans, trading between players, realtime events. These need a separate spec.
- Any change to the production database. Every migration goes to a test project first.


## Economy command execution (implementation in progress)

The additive migration `20261108230000_create_player_command_receipts.sql` introduces a per-player command receipt table and a transaction-safe `commit_player_command` function. It serializes commits by locking the target player's save row, returns the original receipt for a repeated command ID, and rejects stale `updated_at` versions. The RPC is executable only by the Supabase `service_role`; authenticated clients cannot submit arbitrary state directly through it.

The new `supabase/functions/economy-command/index.ts` authenticates the caller with their JWT, reads only that caller's save, applies the canonical game-engine rules for `buyItem`, `sellItem`, `equipItem`, and `unequipItem`, then uses the server-only service-role key to call the atomic RPC. Game modules use explicit TypeScript extensions so Deno can import the same canonical engine instead of duplicating shop prices and equipment rules.

The SQL tests cover first commit, replay, stale-version rejection, and denial of direct authenticated-client RPC execution. Edge Function tests cover auth, malformed commands, canonical purchase pricing, insufficient funds, and stale-version conflicts.

**Not yet complete:** the existing `GameContext` still writes full save snapshots directly from the client. The new endpoint is not wired into the client yet, and client writes have not been revoked. Do not treat the current app as protected against client-side save tampering until every supported mutation is server-backed and the cutover is separately reviewed.

The migration and Edge Function are tested through CI only; neither has been applied or deployed to the production Supabase project.


## Untrusted save recovery — staged quarantine slice (2026-11-09)

The next recovery slice introduces an append-only quarantine, not a restore path:

- `stage-save-recovery` accepts an authenticated owner's `legacy` or `offline` JSON snapshot and writes it only to `player_save_recovery`.
- A caller-provided UUID recovery key makes retries idempotent. A duplicate key returns the first stored record; it never replaces the first payload.
- The endpoint enforces a bounded request/snapshot size, rejects unknown payload fields, verifies the caller JWT, and uses the service role only after authentication.
- RLS permits an owner to read only their own staged records. Client roles have no insert, update, or delete privilege. The database also enforces JSON-object, size, and per-owner idempotency constraints.
- This slice does not read or mutate `player_saves`, does not select a winning copy, and does not grant the staged snapshot authority.

### Resolution policy required before client integration

1. When a cloud save exists, it remains authoritative for all economic and progression fields.
2. A local/legacy snapshot may be retained in quarantine for recovery review, but never written back as a complete `GameState`.
3. A future safe import may copy only allowlisted presentation preferences (character appearance, profile avatar, audio settings) and, only when the cloud account has no hero, the legacy hero's bounded display name and valid class. The server must construct the hero and starter state from canonical rules.
4. Never import gold, gems, level, XP, stat points, stats, inventory, equipment, pets, battle counters, wins, quest/achievement claims, missions, story/tower/dungeon progress, expedition timers/queues, or offline rewards from the client snapshot.
5. Keep the quarantine record until a separate explicit retention/deletion policy is implemented. A recovery operation must be idempotent and version-checked; it must not overwrite a newer cloud save.
6. Do not wire the client to this endpoint or deploy its migration/function until isolated DB and Edge Function tests pass, then separately verify deployment and owner-scoped reads. This does not authorize revoking existing client writes; that remains blocked by the full cutover gates above.
