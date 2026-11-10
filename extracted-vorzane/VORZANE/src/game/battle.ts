import { BATTLE_ENEMIES } from "./catalog.ts";
import { createItemInstance, getDungeonDrop, getEquipmentSellPrice } from "./dungeonItems.ts";
import { addExperience, combatStats } from "./stats.ts";
import { CLASS_PASSIVES, type BattleMode, type ClassId, type EquipmentItem, type GameState } from "./model.ts";
import type { EnemyBlueprint } from "./catalog.ts";

export type BattleTurn = {
  index: number;
  round: number;
  actor: "hero" | "enemy";
  damage: number;
  critical: boolean;
  heroHP: number;
  enemyHP: number;
  message: string;
};

export type BattleResult = {
  state: GameState;
  won: boolean;
  gold: number;
  xp: number;
  dropped: string | null;
  log: string[];
};

export type BattleSequence = {
  id: string;
  mode: BattleMode;
  modeLabel: string;
  hero: { name: string; className: ClassId; level: number; attack: number; passiveName: string };
  enemy: EnemyBlueprint & { level: number; defense: number };
  heroMaxHP: number;
  enemyMaxHP: number;
  turns: BattleTurn[];
  result: BattleResult;
};

const MODE_LABELS: Record<BattleMode, string> = {
  cave: "كهف الرماد",
  dungeon: "زنزانة الهاوية",
  tower: "برج الحراس",
  hard: "تحدي الكسوف",
};
const MODE_SCALE: Record<BattleMode, number> = { cave: 0.82, dungeon: 1, tower: 1.16, hard: 1.42 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function chooseEnemy(state: GameState, mode: BattleMode, random: () => number): EnemyBlueprint {
  const pool = BATTLE_ENEMIES[mode];
  const progress = mode === "dungeon" ? state.dungeonFloor - 1 : mode === "tower" ? state.tower : mode === "cave" ? state.battleWinsByMode.cave : state.battleWinsByMode.hard;
  if (mode === "dungeon" || mode === "tower") return pool[Math.max(0, progress) % pool.length];
  return pool[Math.min(pool.length - 1, Math.floor(clamp(random(), 0, 0.999999) * pool.length))];
}

function damageAmount(attack: number, defense: number): number {
  return Math.max(1, Math.floor(attack * 100 / (100 + Math.max(0, defense) * 2)));
}

export function createBattleSequence(state: GameState, mode: BattleMode, random: () => number = Math.random): BattleSequence | null {
  if (!state.hero) return null;
  const hero = state.hero;
  const player = combatStats(state);
  const floor = mode === "dungeon" ? state.dungeonFloor : mode === "tower" ? state.tower + 1 : Math.max(1, state.battleWinsByMode[mode] + 1);
  const enemyTemplate = chooseEnemy(state, mode, random);
  const floorScale = mode === "dungeon" ? 1 + (floor - 1) * 0.018 : mode === "tower" ? Math.min(2.5, 1 + (floor - 1) * 0.045) : mode === "hard" ? 1 + Math.min(0.5, (floor - 1) * 0.01) : 1 + Math.min(0.28, (floor - 1) * 0.008);
  const level = hero.level;
  const enemyMaxHP = clamp(Math.round((108 + level * 18) * MODE_SCALE[mode] * floorScale * enemyTemplate.hpScale), 40, 1_000_000);
  const enemyAttack = clamp(Math.round((8 + level * 3.3) * MODE_SCALE[mode] * floorScale * enemyTemplate.attackScale), 4, 250_000);
  const enemyDefense = clamp(Math.round((4 + level * 1.4) * MODE_SCALE[mode] * floorScale * enemyTemplate.defenseScale), 0, 100_000);
  const heroMaxHP = player.maxHP;
  const enemy: BattleSequence["enemy"] = {
    ...enemyTemplate,
    level: Math.max(1, Math.floor(level + (floor - 1) * (mode === "dungeon" ? 0.12 : 0.08))),
    defense: enemyDefense,
  };
  const heroFirst = player.stats.agi > enemyTemplate.agility || (player.stats.agi === enemyTemplate.agility && random() >= 0.5);
  let heroHP = heroMaxHP;
  let enemyHP = enemyMaxHP;
  let nextActor: "hero" | "enemy" = heroFirst ? "hero" : "enemy";
  const turns: BattleTurn[] = [];
  let heroAttackCount = 0;
  const maxActions = 200;

  while (heroHP > 0 && enemyHP > 0 && turns.length < maxActions) {
    let damage = 0;
    let critical = false;
    let passiveNote = "";\n    if (nextActor === "hero") {\n      heroAttackCount += 1;\n      damage = damageAmount(player.attack, enemyDefense);\n      if (hero.className === "Archer" && heroAttackCount === 1) { damage = Math.floor(damage * 1.3); passiveNote = " عين الصياد: ضربة افتتاحية!"; }\n      if (hero.className === "Mage" && heroAttackCount % 3 === 0) { damage = Math.floor(damage * 1.45); passiveNote = " نبض الأثير: انفجار سحري!"; }\n      const criticalBonus = hero.className === "Assassin" ? 0.10 : 0;\n      const criticalChance = clamp(0.04 + player.stats.luck * 0.004 + criticalBonus, 0.04, 0.40);\n      critical = random() < criticalChance;\n      if (critical) { damage = Math.floor(damage * (hero.className === "Assassin" ? 1.7 : 1.55)); if (hero.className === "Assassin") passiveNote = " حدس قاتل: ضربة حرجة!"; }\n      enemyHP = Math.max(0, enemyHP - damage);\n    } else {\n      damage = damageAmount(enemyAttack, player.defense);\n      if (hero.className === "Warrior") { damage = Math.max(1, Math.floor(damage * 0.88)); passiveNote = " درع الصمود: خفّف الضربة."; }\n      heroHP = Math.max(0, heroHP - damage);\n    }\n    const round = Math.ceil((turns.length + 1) / 2);\n    const message = nextActor === "hero"\n      ? hero.name + " يهاجم " + enemy.name + " ويسبب " + damage + " ضرر" + (critical ? " بضربة حرجة!" : ".") + passiveNote\n      : enemy.name + " يردّ بضربة ويسبب " + damage + " ضررًا." + passiveNote;\n    turns.push({ index: turns.length + 1, round, actor: nextActor, damage, critical, heroHP, enemyHP, message });
    nextActor = nextActor === "hero" ? "enemy" : "hero";
  }

  const exhausted = turns.length >= maxActions && heroHP > 0 && enemyHP > 0;
  const won = enemyHP <= 0 && !exhausted;

  let next: GameState = JSON.parse(JSON.stringify(state)) as GameState;
  next.battles = Math.min(1_000_000_000, next.battles + 1);
  let gold = 0;
  let xp = 0;
  let dropped: string | null = null;
  if (won) {
    next.wins = Math.min(1_000_000_000, next.wins + 1);
    next.battleWinsByMode = { ...next.battleWinsByMode, [mode]: Math.min(1_000_000_000, (next.battleWinsByMode[mode] ?? 0) + 1) };
    next.achievements.first = true;
    if (next.wins >= 5) next.achievements.wins = true;
    next.quests.first = true;
    if (next.wins >= 3) next.quests.battles = true;
    if (mode === "tower") next.tower = Math.min(100_000, next.tower + 1);
    if (mode === "dungeon") next.dungeonFloor = Math.min(100_000, next.dungeonFloor + 1);
    const levelProgress = Math.pow(Math.max(0, level - 1), 1.45);
    const floorProgress = Math.pow(Math.max(0, floor - 1), 1.3);
    const modeBase = mode === "hard" ? 5 : mode === "tower" ? 4 : mode === "dungeon" ? 3 : 2;
    const modeMultiplier = mode === "hard" ? 1.35 : mode === "tower" ? 1.15 : mode === "dungeon" ? 1 : 0.8;
    const modeGold = (modeBase + levelProgress * 0.9 + floorProgress * 1.4) * modeMultiplier;
    gold = Math.max(1, Math.round(modeGold));
    xp = Math.max(1, Math.round((mode === "dungeon" ? 22 + Math.min(50, floor) * 1.1 : 16 + Math.min(20, floor) * 0.7) + Math.min(40, level) * (mode === "dungeon" ? 2 : 1.5)));
    next.gold = Math.min(1_000_000_000, next.gold + gold);
    const leveled = addExperience(next, xp);
    next = leveled.state;

    if (mode === "dungeon") {
      const dropChance = clamp(0.20 + player.stats.luck * 0.003, 0.20, 0.65);
      if (random() < dropChance) {
        const template = getDungeonDrop(floor, level, random);
        const item: EquipmentItem = createItemInstance(template, `drop-${Date.now()}-${Math.floor(random() * 1_000_000)}`);
        if (next.inventory.length < 500) {
          next.inventory.push(item);
          dropped = template.name;
        } else {
          const quickSale = Math.floor(template.price / 2);
          next.gold = Math.min(1_000_000_000, next.gold + quickSale);
          gold += quickSale;
          dropped = `بيع تلقائي: ${template.name}`;
        }
      }
    }
  }

  return {
    id: `battle-${Date.now()}-${Math.floor(random() * 1_000_000)}`,
    mode,
    modeLabel: MODE_LABELS[mode],
    hero: { name: hero.name, className: hero.className, level: hero.level, attack: player.attack, passiveName: CLASS_PASSIVES[hero.className].name },
    enemy: { ...enemy, name: enemyTemplate.name, title: mode === "dungeon" ? `الطابق ${floor} • ${enemyTemplate.title}` : enemyTemplate.title },
    heroMaxHP,
    enemyMaxHP,
    turns,
    result: { state: next, won, gold, xp, dropped, log: [...turns.map((turn) => turn.message), ...(exhausted ? ["انتهت مدة المواجهة؛ انسحب البطل دون غنيمة."] : [])] },
  };
}

export function resolveBattle(state: GameState, mode: BattleMode): BattleResult {
  const sequence = createBattleSequence(state, mode);
  if (sequence) return sequence.result;
  return { state, won: false, gold: 0, xp: 0, dropped: null, log: ["أنشئ شخصية قبل القتال."] };
}
