import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Switch, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import {
  getMyProfile,
  listIncomingFriendRequests,
  listMyFriends,
  removeFriend,
  respondToFriendRequest,
  saveMyProfile,
  searchPlayers,
  sendFriendRequest,
  setMyProfileSearchable,
  type FriendSummary,
  type IncomingFriendRequest,
  type PlayerProfile,
  type PlayerSearchResult,
} from "../../src/lib/social";
import { palette } from "../../src/theme";

export default function FriendsScreen() {
  const { user } = useAuth();
  const { state } = useGame();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [incoming, setIncoming] = useState<IncomingFriendRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const [friendRows, requestRows, myProfile] = await Promise.all([
      listMyFriends(),
      listIncomingFriendRequests(),
      getMyProfile(user.id),
    ]);
    if (!mountedRef.current) return;
    setFriends(friendRows);
    setIncoming(requestRows);
    setProfile(myProfile);
    if (myProfile) setDisplayName(myProfile.display_name);
    else if (state.hero?.name && !displayName) setDisplayName(state.hero.name);
  }, [user?.id, state.hero?.name, displayName]);

  useEffect(() => {
    if (!user?.id) return;
    void refresh().catch((error) => {
      if (!mountedRef.current) return;
      setNotice(error instanceof Error ? error.message : "تعذر تحديث قائمة الأصدقاء. حاول مجددًا.");
    });
  }, [refresh]);

  useEffect(() => { setResults([]); }, [query]);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await refresh();
      setNotice(success);
    } catch (error) {
      if (mountedRef.current) setNotice(error instanceof Error ? error.message : "تعذر تنفيذ العملية.");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const saveProfile = async () => {
    const name = displayName.trim();
    if (name.length < 3 || name.length > 24) {
      setNotice("اسم اللاعب يجب أن يتكون من 3 إلى 24 حرفًا.");
      return;
    }
    await run(async () => {
      const saved = await saveMyProfile(name, String(state.profileAvatarId));
      if (mountedRef.current) setProfile(saved);
    }, "تم حفظ ملف اللاعب.");
  };

  const toggleSearchable = async (enabled: boolean) => {
    if (!profile) return;
    await run(async () => {
      await setMyProfileSearchable(enabled);
      if (mountedRef.current) setProfile((current) => current ? { ...current, is_searchable: enabled } : current);
      if (!enabled) setResults([]);
    }, enabled ? "أصبح ملفك ظاهرًا في البحث." : "أصبح ملفك مخفيًا من البحث.");
  };

  const sendRequest = async (playerId: string) => {
    await run(async () => {
      await sendFriendRequest(playerId);
      if (mountedRef.current) {
        setResults((current) => current.map((player) =>
          player.user_id === playerId ? { ...player, friend_state: "outgoing" } : player
        ));
      }
    }, "تم إرسال طلب الصداقة.");
  };

  const doSearch = async () => {
    if (!profile) {
      setNotice("أنشئ ملف اللاعب أولًا قبل البحث عن الأصدقاء.");
      return;
    }
    if (!profile.is_searchable) {
      setNotice("فعّل ظهور ملفك في البحث قبل استخدام المجتمع.");
      return;
    }
    if (query.trim().length < 3) {
      setNotice("اكتب ثلاثة أحرف على الأقل للبحث.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const players = await searchPlayers(query.trim());
      if (mountedRef.current) setResults(players);
    } catch (error) {
      if (mountedRef.current) setNotice(error instanceof Error ? error.message : "تعذر البحث عن اللاعبين.");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  return <AppScreen>
    <View style={styles.content}>
      <PageTitle eyebrow="مجتمع VORZANE" title="الأصدقاء" subtitle="تحكم بظهور ملفك، وابحث عن لاعبين، وأدر طلبات الصداقة." />
      <AppButton label="صندوق الإشعارات" icon="notifications-outline" onPress={() => router.push("/(tabs)/notifications" as never)} variant="secondary" />
      {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.gold} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}

      <SectionTitle title="ملف اللاعب والخصوصية" icon="shield-checkmark-outline" />
      <Card style={styles.panel}>
        {profile ? <>
          <Txt style={styles.profileName}>{profile.display_name}</Txt>
          <View style={styles.privacyRow}>
            <View style={styles.playerInfo}>
              <Txt style={styles.playerName}>السماح بالظهور في البحث</Txt>
              <Txt muted style={styles.playerMeta}>{profile.is_searchable ? "يمكن للاعبين العثور عليك بالاسم." : "ملفك مخفي عن نتائج البحث."}</Txt>
            </View>
            <Switch
              value={profile.is_searchable}
              onValueChange={toggleSearchable}
              disabled={busy}
              trackColor={{ false: "#293744", true: palette.jadeDark }}
              thumbColor={profile.is_searchable ? palette.jade : "#A9B7BE"}
            />
          </View>
          <TextInput value={displayName} onChangeText={setDisplayName} maxLength={24} placeholder="اسم اللاعب" placeholderTextColor={palette.muted} style={styles.input} />
          <AppButton label="حفظ اسم اللاعب" icon="save-outline" onPress={saveProfile} disabled={busy || displayName.trim() === profile.display_name} variant="secondary" />
        </> : <>
          <Txt style={styles.playerName}>أنشئ ملفك داخل مجتمع VORZANE</Txt>
          <Txt muted style={styles.playerMeta}>اسم الملف مستقل عن بريدك الإلكتروني. يمكنك إخفاؤه من البحث لاحقًا.</Txt>
          <TextInput value={displayName} onChangeText={setDisplayName} maxLength={24} placeholder="اسم اللاعب (3–24 حرفًا)" placeholderTextColor={palette.muted} style={styles.input} />
          <AppButton label="إنشاء ملف اللاعب" icon="person-add-outline" onPress={saveProfile} loading={busy} disabled={busy || displayName.trim().length < 3} />
        </>}
      </Card>

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
        <AppButton label="بحث" onPress={doSearch} loading={busy} disabled={busy || !profile?.is_searchable || query.trim().length < 3} icon="search-outline" />
      </Card>
      {results.map((player) => <Card key={player.user_id} style={styles.playerRow}>
        {player.friend_state === "none" ? <AppButton label="إضافة" onPress={() => sendRequest(player.user_id)} small disabled={busy} /> : <Pill label={player.friend_state === "friends" ? "صديق" : player.friend_state === "incoming" ? "طلب وارد" : "تم الإرسال"} tone={player.friend_state === "friends" ? "jade" : "muted"} />}
        <View style={styles.playerInfo}><Txt style={styles.playerName}>{player.display_name}</Txt><Txt muted style={styles.playerMeta}>ملف لاعب VORZANE</Txt></View>
        <Icon name="person-outline" color={palette.jade} size={22} />
      </Card>)}
      <AppButton label="تحديث البيانات" onPress={() => run(refresh, "تم تحديث بيانات المجتمع.")} variant="ghost" disabled={busy} icon="refresh-outline" />
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: 13, width: "100%" },
  panel: { gap: 10, backgroundColor: "#13242C", padding: 13 },
  input: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, color: palette.text, textAlign: "right", backgroundColor: "#0B171D" },
  profileName: { fontSize: 15, fontWeight: "900", textAlign: "right" },
  privacyRow: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 5 },
  playerRow: { padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  playerInfo: { flex: 1, alignItems: "flex-end" },
  playerName: { fontSize: 13, fontWeight: "900", textAlign: "right" },
  playerMeta: { fontSize: 10, marginTop: 3, textAlign: "right" },
  playerActions: { flexDirection: "row", gap: 5 },
  empty: { padding: 16, alignItems: "center" },
  notice: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, fontSize: 11 },
});
