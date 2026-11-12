export type Settings = { sfx: boolean; volume: number; musicEnabled: boolean; musicVolume: number };
export type GameState = Record<string, unknown> & { hero: unknown; settings: Settings };

function weekKey(date = new Date()): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

export function createFreshState(): GameState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    hero: null,
    characterStyle: { gender: "male", appearance: 0, hairstyle: "short", hairColor: "obsidian", face: "classic", outfit: "adventurer", body: "balanced" },
    missionPeriods: {
      daily: { key: today, baseline: { wins: 0, expeditions: 0, level: 1 }, claimed: {} },
      weekly: { key: weekKey(), baseline: { wins: 0, expeditions: 0, level: 1 }, claimed: {} },
      season: { key: today.slice(0, 7), baseline: { wins: 0, expeditions: 0, level: 1 }, claimed: {} },
    },
    roaming: { health: 100, maxHealth: 100, fragments: 0, fragmentsCollected: 0, fragmentProgress: 0, eventsCompleted: 0, healthUpdatedAt: Date.now(), storyFlags: [], fairyNextAt: 0, fairyReunited: false, echoStarted: false, echoStage: 0, echoFailures: 0, echoNextAt: 0, echoRoute: null, eventsSeen: [], activeChain: null, chainStage: 0, chainRoute: null, chainNextAtEvent: 0, lastEventAt: 0, merchantRefreshAt: 0, gemRefillDate: today, gemRefillsUsed: 0 },
    dimas: { highestFloor: 0, claimedMilestones: [], lastCompletedAt: 0 },
    longQuestStartedAt: Date.now(),
    claimedLongQuestIds: [],
    profileAvatarId: "brand",
    gold: 500,
    gems: 50,
    inventory: [],
    equipped: {},
    pets: [],
    activePet: null,
    tower: 0,
    story: 0,
    dungeonFloor: 1,
    battleWinsByMode: { cave: 0, dungeon: 0, tower: 0, hard: 0, roaming: 0 },
    battles: 0,
    wins: 0,
    expeditionsCompleted: 0,
    quests: { first: false, battles: false, level: false },
    achievements: { first: false, level: false, wins: false },
    claimedQuestRewards: {},
    activeExpedition: null,
    expeditionQueue: [],
    offlineSummary: [],
    lastSeenAt: Date.now(),
    settings: { sfx: true, volume: 20, musicEnabled: true, musicVolume: 24 },
  };
}
