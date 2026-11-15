import type { GameState } from "../game/model";

function serverOwnedSnapshot(state: GameState) {
  return {
    serverResetEpoch: state.serverResetEpoch ?? null,
    gold: state.gold,
    gems: state.gems,
    inventory: state.inventory,
    equipped: state.equipped,
    pets: state.pets,
    activePet: state.activePet,
    roaming: {
      fragments: state.roaming.fragments,
      fragmentsCollected: state.roaming.fragmentsCollected,
      gemRefillDate: state.roaming.gemRefillDate,
      gemRefillsUsed: state.roaming.gemRefillsUsed,
    },
  };
}

function nonEconomySnapshot(state: GameState) {
  return {
    ...state,
    serverResetEpoch: null,
    gold: 0,
    gems: 0,
    inventory: [],
    equipped: {},
    pets: [],
    activePet: null,
    roaming: {
      ...state.roaming,
      fragments: 0,
      fragmentsCollected: 0,
      gemRefillDate: "",
      gemRefillsUsed: 0,
    },
  };
}

/** Replaces client-supplied economic values with the values accepted by PostgreSQL. */
export function reconcileServerOwnedEconomy(clientState: GameState, serverState: GameState): GameState {
  return {
    ...clientState,
    serverResetEpoch: serverState.serverResetEpoch,
    gold: serverState.gold,
    gems: serverState.gems,
    inventory: serverState.inventory,
    equipped: serverState.equipped,
    pets: serverState.pets,
    activePet: serverState.activePet,
    roaming: {
      ...clientState.roaming,
      fragments: serverState.roaming.fragments,
      fragmentsCollected: serverState.roaming.fragmentsCollected,
      gemRefillDate: serverState.roaming.gemRefillDate,
      gemRefillsUsed: serverState.roaming.gemRefillsUsed,
    },
  };
}

export function hasServerOwnedEconomyChanged(before: GameState, after: GameState): boolean {
  return JSON.stringify(serverOwnedSnapshot(before)) !== JSON.stringify(serverOwnedSnapshot(after));
}

/** Detects newer non-economic progress while a previous snapshot was in flight. */
export function hasNonEconomyProgressChanged(current: GameState, snapshot: GameState): boolean {
  return JSON.stringify(nonEconomySnapshot(current)) !== JSON.stringify(nonEconomySnapshot(snapshot));
}
