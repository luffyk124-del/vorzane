import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { listMyConversations, type PlayerConversation } from "../../src/lib/social";
import { palette } from "../../src/theme";

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<PlayerConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const rows = await listMyConversations();
    setConversations(rows);
    setError("");
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void refresh().catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "تعذر تحميل الرسائل.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]));

  return <AppScreen>
    <View style={styles.content}>
      <PageTitle eyebrow="التواصل" title="الرسائل" subtitle="كل محادثاتك مع اللاعبين، سواء كانوا ضمن أصدقائك أم لا." trailing={<AppButton label="تحديث" icon="refresh-outline" variant="secondary" small onPress={() => { setLoading(true); void refresh().catch((e) => setError(e instanceof Error ? e.message : "تعذر التحديث.")).finally(() => setLoading(false)); }} />} />
      <Card style={styles.info}>
        <Icon name="chatbubbles-outline" color={palette.jade} size={19} />
        <Txt style={styles.infoText}>تقدر تبدأ محادثة جديدة من زر «مراسلة اللاعب» في الملف الشخصي لأي لاعب.</Txt>
      </Card>
      <SectionTitle title={`محادثاتك (${conversations.length})`} icon="mail-outline" />
      {error ? <Card style={styles.error}><Txt style={styles.errorText}>{error}</Txt></Card> : null}
      {loading ? <Card style={styles.empty}><Txt muted>جارٍ تحميل المحادثات...</Txt></Card> : conversations.length ? conversations.map((item) => (
        <Pressable key={item.other_user_id} onPress={() => router.push({ pathname: "/chat", params: { id: item.other_user_id } } as never)} accessibilityRole="button">
          <Card style={styles.conversation}>
            <View style={styles.chevron}><Icon name="chevron-back" color={palette.dim} size={18} /></View>
            <View style={styles.details}>
              <View style={styles.titleRow}>
                <Txt style={styles.name}>{item.display_name}</Txt>
                {item.unread_count > 0 ? <Pill label={item.unread_count > 99 ? "99+" : String(item.unread_count)} tone="jade" /> : null}
              </View>
              <Txt muted style={styles.preview} numberOfLines={2}>{item.last_message}</Txt>
              <Txt muted style={styles.time}>{new Date(item.last_message_at).toLocaleString("ar")}</Txt>
            </View>
            <View style={styles.avatar}><Icon name="person-outline" color={palette.jade} size={20} /></View>
          </Card>
        </Pressable>
      )) : <Card style={styles.empty}><Icon name="chatbubbles-outline" size={27} color={palette.dim} /><Txt muted>ما عندك محادثات حتى الآن.</Txt><Txt muted style={styles.hint}>افتح ملف أي لاعب وابدأ محادثة جديدة.</Txt></Card>}
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: 12, width: "100%", paddingBottom: 20 },
  info: { padding: 11, flexDirection: "row", alignItems: "center", gap: 9, borderColor: "rgba(98,216,195,0.24)" },
  infoText: { flex: 1, fontSize: 11, lineHeight: 17 },
  error: { padding: 10, borderColor: "rgba(230,199,124,0.3)" },
  errorText: { color: palette.gold, textAlign: "right", fontSize: 11 },
  conversation: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  chevron: { alignItems: "center", justifyContent: "center" },
  details: { flex: 1, alignItems: "flex-end", gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 13, fontWeight: "900" },
  preview: { fontSize: 11, textAlign: "right" },
  time: { fontSize: 9 },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line },
  empty: { padding: 22, alignItems: "center", gap: 9 },
  hint: { fontSize: 10 },
});
