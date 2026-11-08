import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, Meter, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { QUESTS } from "../../src/game/catalog";
import { canClaimQuest, claimQuest, createBattleSequence, getQuestProgress, EXPLORATION_ACHIEVEMENTS, canClaimExplorationAchievement, claimExplorationAchievement, getExplorationAchievementProgress, type BattleResult, type BattleSequence, type BattleMode } from "../../src/game/engine";
import { BattleArena } from "../../src/components/BattleArena";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

const achievementRows = [
  { id: "first", title: "بداية الرحلة", description: "اربح أول معركة", icon: "sparkles" as const },
  { id: "level", title: "ارتقاء", description: "بلغ المستوى الخامس", icon: "trending-up" as const },
  { id: "wins", title: "صاحب النصر", description: "اربح خمس معارك", icon: "trophy" as const },
];

export default function QuestsScreen() {
  const { state, update, fpsMode, command } = useGame();
  const [sequence, setSequence] = useState<BattleSequence | null>(null);
  const quests = QUESTS.map((quest) => ({
    ...quest,
    progress: Math.min(getQuestProgress(state, quest.id), quest.target),
    available: canClaimQuest(state, quest.id),
    claimed: !!state.claimedQuestRewards[quest.id],
  }));
  const startBattle = (mode: BattleMode) => {
    if (fpsMode) { void command({ type: "startBattle", mode }); return; }
    const battle = createBattleSequence(state, mode);
    if (battle) setSequence(battle);
  };
  const settleBattle = useCallback((result: BattleResult) => { if (!fpsMode) update(() => result.state); }, [update, fpsMode]);

  return <AppScreen>
    <PageTitle eyebrow="مسارك في الظلال" title="المهام والإنجازات" subtitle="زنزانة لا تنتهي، خصوم متبدلون، وأهداف تمنح تقدمك معنى." trailing={<Pill label={`${state.wins} انتصار`} icon="trophy" tone="gold" />} />
    <Card style={styles.dungeonCard}>
      <View style={styles.dungeonIcon}><Icon name="skull" color={palette.gold} size={22} /></View>
      <View style={styles.dungeonBody}>
        <Pill label={`الطابق ${state.dungeonFloor}`} tone="gold" />
        <Txt style={styles.dungeonTitle}>زنزانة الهاوية</Txt>
        <Txt muted style={styles.cardCopy}>قاتل تلقائيًا، استعد صحتك بعد كل نصر، واجمع غنائم ندرتها ترتفع مع المستوى والطابق.</Txt>
      </View>
      <AppButton label="انزل" icon="arrow-back" onPress={() => startBattle("dungeon")} variant="jade" small />
    </Card>

    <Card style={styles.towerCard}>
      <View style={styles.towerBadge}><Icon name="business" color={palette.violet} size={21} /></View>
      <View style={styles.towerBody}><Pill label={`الطابق ${state.tower + 1}`} tone="muted" /><Txt style={styles.towerTitle}>برج الحراس</Txt><Txt muted style={styles.cardCopy}>خصوم متنوعون ومواجهة أصعب من الطابق السابق.</Txt></View>
      <AppButton label="تحدّ" icon="flash" onPress={() => startBattle("tower")} variant="secondary" small />
    </Card>

    <Card style={styles.modeCard}>
      <View style={styles.modeIntro}><Icon name="bonfire" color={palette.red} size={19} /><Txt style={styles.modeTitle}>ميادين أخرى</Txt></View>
      <View style={styles.modeButtons}>
        <AppButton label="كهف الرماد" icon="bonfire" onPress={() => startBattle("cave")} variant="secondary" small style={{ flex: 1 }} />
        <AppButton label="تحدي الكسوف" icon="moon" onPress={() => startBattle("hard")} variant="ghost" small style={{ flex: 1 }} />
      </View>
      <Txt muted style={styles.modeHint}>لكل ميدان خصوم وخصائص مختلفة؛ عتاد الزنزانة لا يسقط من هذه المعارك.</Txt>
    </Card>

    <SectionTitle title="مهام اللاعب" icon="list-circle-outline" action={<Pill label={`${quests.filter((quest) => quest.available).length} جاهزة`} tone="jade" />} />
    {quests.map((quest) => {
      const tone = quest.category === "الزنزانة" || quest.category === "البرج" ? "gold" : quest.category === "الرحلات" ? "jade" : quest.category === "قتال" ? "red" : "muted";
      return <Card key={quest.id} style={styles.questCard}>
        <AppButton label={quest.claimed ? "استُلمت" : quest.available ? `استلم ${quest.rewardGold}` : "غير مكتملة"} icon={quest.claimed ? "checkmark" : "gift-outline"} onPress={() => quest.available && (fpsMode ? void command({ type: "claimQuest", questId: quest.id }) : update((current) => claimQuest(current, quest.id)))} variant={quest.available ? "jade" : "secondary"} small disabled={!quest.available || quest.claimed} />
        <View style={styles.questBody}>
          <View style={styles.questHeading}><Pill label={quest.category} tone={tone} /><Pill label={`+${quest.rewardGold} ذهب`} tone="gold" /></View>
          <Txt style={styles.questTitle}>{quest.title}</Txt>
          <Txt muted style={styles.questCopy}>{quest.description}</Txt>
          <View style={styles.questProgress}><Txt muted style={styles.progressLabel}>{quest.progress} / {quest.target}</Txt><Meter value={quest.progress} max={quest.target} color={quest.claimed ? palette.dim : palette.jade} height={6} /></View>
        </View>
        <View style={styles.questIcon}><Icon name={quest.icon as never} color={quest.claimed ? palette.dim : palette.gold} size={20} /></View>
      </Card>;
    })}

    <SectionTitle title="الأوسمة" icon="ribbon-outline" />
    <View style={styles.achievementList}>
      {achievementRows.map((item) => {
        const unlocked = !!state.achievements[item.id as keyof typeof state.achievements];
        return <Card key={item.id} style={[styles.achievementCard, unlocked && styles.achievementUnlocked]}>
          <View style={[styles.achievementIcon, unlocked && { backgroundColor: "rgba(230,199,124,0.13)" }]}><Icon name={item.icon} color={unlocked ? palette.gold : palette.dim} size={19} /></View>
          <View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={[styles.questTitle, !unlocked && { color: palette.muted }]}>{item.title}</Txt><Txt muted style={styles.questCopy}>{item.description}</Txt></View>
          <Icon name={unlocked ? "checkmark-circle" : "lock-closed-outline"} color={unlocked ? palette.jade : palette.dim} size={18} />
        </Card>;
      })}
    </View>
    <SectionTitle title="إنجازات الاستكشاف" icon="compass-outline" action={<Pill label="مكافآت ذهبية" tone="gold" />} />
    {EXPLORATION_ACHIEVEMENTS.map((achievement) => {
      const progress = Math.min(getExplorationAchievementProgress(state, achievement.id), achievement.target);
      const claimed = !!state.claimedQuestRewards[`achievement:${achievement.id}`];
      const available = canClaimExplorationAchievement(state, achievement.id);
      return <Card key={achievement.id} style={styles.questCard}>
        <AppButton
          label={claimed ? "استُلمت" : available ? `استلم ${achievement.rewardGold}` : "غير مكتمل"}
          icon={claimed ? "checkmark" : "gift-outline"}
          onPress={() => !fpsMode && update((current) => claimExplorationAchievement(current, achievement.id))}
          variant={available ? "jade" : "secondary"}
          small
          disabled={!available || claimed || fpsMode}
        />
        <View style={styles.questBody}>
          <View style={styles.questHeading}>
            <Pill label="استكشاف" tone="jade" />
            <Pill label={`+${achievement.rewardGold} ذهب`} tone="gold" />
          </View>
          <Txt style={styles.questTitle}>{achievement.title}</Txt>
          <Txt muted style={styles.questCopy}>{achievement.description}</Txt>
          <View style={styles.questProgress}>
            <Txt muted style={styles.progressLabel}>{progress} / {achievement.target}</Txt>
            <Meter value={progress} max={achievement.target} color={claimed ? palette.dim : palette.jade} height={6} />
          </View>
        </View>
        <View style={styles.questIcon}><Icon name={achievement.icon as never} color={claimed ? palette.dim : palette.gold} size={20} /></View>
      </Card>;
    })}
    <BattleArena sequence={sequence} onBattleSettled={settleBattle} onClose={() => setSequence(null)} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  dungeonCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 10, borderColor: "rgba(230,199,124,0.28)", backgroundColor: "#171C25" },
  dungeonIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: "rgba(230,199,124,0.11)", alignItems: "center", justifyContent: "center" },
  dungeonBody: { flex: 1, alignItems: "flex-end", gap: 4 },
  dungeonTitle: { fontSize: 16, fontWeight: "900" },
  cardCopy: { fontSize: 11, lineHeight: 17, textAlign: "right" },
  towerCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 10 },
  towerBadge: { width: 43, height: 43, borderRadius: 15, backgroundColor: "rgba(169,154,232,0.11)", alignItems: "center", justifyContent: "center" },
  towerBody: { flex: 1, alignItems: "flex-end", gap: 4 },
  towerTitle: { fontSize: 15, fontWeight: "900" },
  modeCard: { gap: 9, padding: 14, backgroundColor: "#171C25" },
  modeIntro: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 7 },
  modeTitle: { fontSize: 13, fontWeight: "900" },
  modeButtons: { flexDirection: "row", gap: 8 },
  modeHint: { fontSize: 10, lineHeight: 15, textAlign: "right" },
  questCard: { padding: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  questBody: { flex: 1, alignItems: "flex-end", gap: 5 },
  questHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  questTitle: { fontSize: 13, fontWeight: "900" },
  questCopy: { fontSize: 11, lineHeight: 16, textAlign: "right" },
  questProgress: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  progressLabel: { fontSize: 10, minWidth: 36 },
  questIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: "rgba(230,199,124,0.08)", alignItems: "center", justifyContent: "center" },
  achievementList: { gap: 8 },
  achievementCard: { padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  achievementUnlocked: { borderColor: "rgba(98,216,195,0.25)" },
  achievementIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
});
