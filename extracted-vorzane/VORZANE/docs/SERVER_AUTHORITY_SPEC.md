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

## Not in this spec

- Multiplayer, clans, trading between players, realtime events. These need a separate spec.
- Any change to the production database. Every migration goes to a test project first.
