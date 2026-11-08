import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  listIncomingFriendRequests,
  listMyFriends,
  removeFriend,
  respondToFriendRequest,
  searchPlayers,
  sendFriendRequest,
  type FriendSummary,
  type IncomingFriendRequest,
  type PlayerSearchResult,
} from "../../src/lib/social";
import { palette } from "../../src/theme";

export default function FriendsScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [incoming, setIncoming] = useState<IncomingFriendRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    if (!user) return;
    const [friendRows, requestRows] = await Promise.all([
      listMyFriends(),
      listIncomingFriendRequests(),
    ]);
    setFriends(friendRows);
    setIncoming(requestRows);
  };

  useEffect(() => {
    let active = true;
    if (user?.id) {
      void refresh().catch((error) => {
        if (!active) return;
        setNotice(error instanceof Error ? error.message : "تعذر تحديث قائمة الأصدقاء. حاول مجددًا.");
      });
    }
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => { setResults([]); }, [query]);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await refresh();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر تنفيذ العملية.");
    } finally {
      setBusy(false);
    }
  };

  const doSearch = async () => {
    if (query.trim().length < 3) {
      setNotice("اكتب ثلاثة أحرف على الأقل للبحث.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      setResults(await searchPlayers(query.trim()));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر البحث عن اللاعبين.");
    } finally {
      setBusy(false);
    }
  };

  return <AppScreen>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PageTitle eyebrow="مجتمع VORZANE" title="الأصدقاء" subtitle="ابحث عن لاعبين، وأدر طلبات الصداقة وقائمتك." />
      {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.gold} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}

      <SectionTitle title={`طلبات الصداقة الواردة (${incoming.length})`} icon="mail-unread-outline" />
      {incoming.length ? incoming.map((request) => <Card key={request.request_id} style={styles.playerRow}>
        <View style={styles.playerActions}>
          <AppButton label="قبول" onPress={() => run(() => respondToFriendRequest(request.request_id, true), "تمت إضافة الصديق.")} small disabled={busy} />
          <AppButton label="رفض" onPress={() => run(() => respondToFriendRequest(request.request_id, false), "تم رفض الطلب.")} small variant="secondary" disabled={busy} />
        </View>
        <View style={styles.playerInfo}><Txt style={styles.playerName}>{request.display_name}</Txt><Txt muted style={styles.playerMeta}>طلب صداقة وارد</Txt></View>
        <Icon name="person-add-outline" color={palette.jade} size={22} />
      </Card>) : <Card style={styles.empty}><Txt muted>لا توجد طلبات واردة حاليًا.</Txt></Card>}

      <SectionTitle title={`أصدقائي (${friends.length})`} icon="people-outline" />
      {friends.length ? friends.map((friend) => <Card key={friend.user_id} style={styles.playerRow}>
        <AppButton label="إزالة" onPress={() => Alert.alert("إزالة صديق", `هل تريد إزالة ${friend.display_name} من قائمة أصدقائك؟`, [
          { text: "إلغاء", style: "cancel" },
          { text: "إزالة", style: "destructive", onPress: () => run(() => removeFriend(friend.user_id), "تمت إزالة الصديق من قائمتك.") },
        ])} variant="secondary" small disabled={busy} />
        <View style={styles.playerInfo}><Txt style={styles.playerName}>{friend.display_name}</Txt><Txt muted style={styles.playerMeta}>منذ {new Date(friend.friends_since).toLocaleDateString("ar")}</Txt></View>
        <Icon name="person-circle-outline" color={palette.jade} size={22} />
      </Card>) : <Card style={styles.empty}><Txt muted>قائمة الأصدقاء فارغة. ابحث عن لاعبين لإرسال طلبات صداقة.</Txt></Card>}

      <SectionTitle title="البحث عن لاعبين" icon="search-outline" />
      <Card style={styles.panel}>
        <TextInput value={query} onChangeText={setQuery} maxLength={24} placeholder="اسم اللاعب..." placeholderTextColor={palette.muted} style={styles.input} returnKeyType="search" onSubmitEditing={doSearch} />
        <AppButton label="بحث" onPress={doSearch} loading={busy} disabled={busy || query.trim().length < 3} icon="search-outline" />
      </Card>
      {results.map((player) => <Card key={player.user_id} style={styles.playerRow}>
        {player.friend_state === "none" ? <AppButton label="إضافة" onPress={() => run(async () => { await sendFriendRequest(player.user_id); }, "تم إرسال طلب الصداقة.")} small disabled={busy} /> : <Pill label={player.friend_state === "friends" ? "صديق" : player.friend_state === "incoming" ? "طلب وارد" : "تم الإرسال"} tone={player.friend_state === "friends" ? "jade" : "muted"} />}
        <View style={styles.playerInfo}><Txt style={styles.playerName}>{player.display_name}</Txt><Txt muted style={styles.playerMeta}>ملف لاعب VORZANE</Txt></View>
        <Icon name="person-outline" color={palette.jade} size={22} />
      </Card>)}
      <AppButton label="تحديث البيانات" onPress={() => run(refresh, "تم تحديث بيانات المجتمع.")} variant="ghost" disabled={busy} icon="refresh-outline" />
    </ScrollView>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 120, gap: 13, width: "100%", maxWidth: 560, alignSelf: "center" },
  panel: { gap: 10, backgroundColor: "#13242C" },
  input: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, color: palette.text, textAlign: "right", backgroundColor: "#0B171D" },
  fieldLabel: { fontSize: 11, fontWeight: "800", textAlign: "right" },
  avatarRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  avatarOption: { minWidth: 82, minHeight: 48, flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: palette.line, borderRadius: 12, padding: 9 },
  avatarSelected: { backgroundColor: palette.gold, borderColor: palette.gold },
  avatarText: { fontSize: 10, color: palette.muted, fontWeight: "800" },
  avatarTextSelected: { color: palette.ink },
  privacyRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 5 },
  playerRow: { padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  playerInfo: { flex: 1, alignItems: "flex-end" },
  playerName: { fontSize: 14, fontWeight: "900" },
  playerMeta: { fontSize: 10, marginTop: 3 },
  playerActions: { flexDirection: "row", gap: 5 },
  empty: { padding: 16, alignItems: "center" },
  notice: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, fontSize: 11 },
});
