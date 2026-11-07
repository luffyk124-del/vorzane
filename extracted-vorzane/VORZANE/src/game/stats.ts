import { PETS } from "./catalog";
import { findEquipmentTemplate } from "./dungeonItems";
import type { GameState, StatBlock, StatKey } from "./model";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function totalStats(state: GameState): StatBlock {
  const hero = state.hero;
  const total: StatBlock = hero ? { ...hero.stats } : { str: 0, def: 0, vit: 0, agi: 0, luck: 0 };
  for (const item of Object.values(state.equipped)) {
    if (!item) continue;
    const template = findEquipmentTemplate(item);
    if (!template) continue;
    const requiredLevel = template.requiredLevel ?? item.requiredLevel ?? 1;
    const requiredFloor = template.requiredDungeonFloor ?? item.requiredDungeonFloor ?? 1;
    if ((hero?.level ?? 1) < requiredLevel || state.dungeonFloor < requiredFloor) continue;
    for (const key of Object.keys(template.bonus) as StatKey[]) total[key] += template.bonus[key] ?? 0;
  }
  const pet = PETS.find((item) => item.id === state.activePet && state.pets.includes(item.id) && !!hero && hero.level >= item.requiredLevel);
  if (pet) for (const key of Object.keys(pet.bonus) as StatKey[]) total[key] += pet.bonus[key] ?? 0;
  return total;
}

export function combatStats(state: GameState) {
  const stats = totalStats(state);
  return {
    stats,
    power: stats.str * 2 + stats.def * 2 + stats.vit + stats.agi * 2 + stats.luck,
    maxHP: 100 + stats.vit * 20,
    attack: 10 + stats.str * 2,
    defense: stats.def * 2,
    xpNeeded: 100 + Math.max(0, (state.hero?.level ?? 1) - 1) * 60,
  };
}

export function addExperience(state: GameState, amount: number): { state: GameState; levelsGained: number } {
  const next = clone(state);
  if (!next.hero) return { state: next, levelsGained: 0 };
  next.hero.exp += Math.max(0, Math.floor(amount));
  let levelsGained = 0;
  while (next.hero.exp >= 100 + (next.hero.level - 1) * 60) {
    next.hero.exp -= 100 + (next.hero.level - 1) * 60;
    next.hero.level += 1;
    next.hero.statPoints += 5;
    levelsGained += 1;
  }
  if (next.hero.level >= 5) next.achievements.level = true;
  if (next.hero.level >= 2) next.quests.level = true;
  return { state: next, levelsGained };
}
