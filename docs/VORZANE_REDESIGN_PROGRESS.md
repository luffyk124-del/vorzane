# VORZANE Redesign Progress

This document tracks the ongoing product redesign. It is a working roadmap, not a declaration that the game is complete.

## Design direction

Evolve VORZANE from a basic dark-fantasy idle RPG prototype into a coherent mobile-first RPG with:
- A clear world identity and readable navigation.
- Distinct class identities and meaningful combat decisions.
- A connected campaign that gives progression narrative purpose.
- Rewarding dungeon, tower, expedition, equipment, and companion loops.
- Consistent visual language, responsive layouts, accessible controls, and reliable saves.

## Completed iterations on `redesign/vorzane-world-overhaul`

### Iteration 1 — Core navigation
- Added a persistent five-destination navigation dock for Camp, Expeditions, Gear, Quests, and Hero Profile.
- Kept the drawer for secondary destinations.
- Added a mobile browser test for route switching and horizontal overflow.

### Iteration 2 — Class identity and combat
- Warrior: reduces incoming damage by 12% (Fortitude).
- Mage: every third attack gains a 45% damage surge (Aether Pulse).
- Assassin: gains critical chance and a stronger critical multiplier (Killer Instinct).
- Archer: opens each encounter with a 30% stronger first strike (Hunter's Eye).
- Exposed passive names/descriptions in hero selection and the camp, and the passive name in battle.
- Added deterministic engine tests for all four class passives.

### Iteration 3 — Ashen World campaign
- Added five sequential story chapters tied to wins, dungeon floors, tower floors, expeditions, and hero level.
- Chapter rewards grant gold and XP once, using the existing `story` save field.
- Added engine tests for sequential unlocks and duplicate-claim prevention.
- Added a campaign section to the Quests screen.

## Next product passes

1. **Combat depth:** active class skills, cooldown/resource rules, boss encounters, enemy traits, combat feedback, and balance simulations.
2. **Equipment loop:** item comparison, recommended loadouts, rarity/affix identity, set bonuses, filters, sorting, and safer bulk inventory management.
3. **World and art direction:** cohesive region map, enemy/companion visual consistency, environmental backdrops, and richer battle presentation.
4. **Progression:** campaign chapter variety, milestone rewards, clearer daily/weekly/seasonal objectives, and better onboarding.
5. **Social play:** party/co-op goals, friend activity, and fair competitive systems, subject to backend security review.
6. **Polish and reliability:** accessibility, low-end mobile performance, offline/save conflict handling, and responsive layout checks.

## Safety and release gates

- Keep work on a feature branch and submit changes through a pull request.
- Preserve Manus and the existing Supabase project and player data.
- Do not run production migrations, destructive SQL, production writes, or hosted Auth/RLS changes without explicit approval.
- Do not merge or deploy automatically.
- A redesign pass is not complete until the relevant engine/browser tests, typecheck, and web build have been checked.
