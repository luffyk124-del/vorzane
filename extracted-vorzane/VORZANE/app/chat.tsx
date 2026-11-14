import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, Txt } from "../src/components/ui";
import { useAuth } from "../src/contexts/AuthContext";
import {
  blockPlayer,
  getPublicPlayerProfile,
  listPlayerMessages,
  markPlayerMessagesRead,
  reportPlayer,
  sendPlayerMessage,
  type PlayerMessage,
  type PublicPlayerProfile,
} from "../src/lib/social";
import { palette } from "../src/theme";

export default function PlayerChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const playerId = String(id ?? "");
  const [profile, setProfile] = useState<PublicPlayerProfile | null>(null);
  const [messages, setMessages] = useState<PlayerMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    if (!playerId || !user?.id || playerId === user.id) {
      setNotice("لا يمكن فتح هذه المحادثة.");
      setLoading(false);
      return;
    }
    const [player, rows] = await Promise.all([
      getPublicPlayerProfile(playerId),
      listPlayerMessages(playerId),
    ]);
    if (!player) throw new Error("لم يتم العثور على اللاعب.");
    setProfile(player);
    setMessages(rows.slice().reverse());
    await markPlayerMessagesRead(playerId);
  }, [playerId, user?.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = () => {
      void refresh().catch((error) => {
        if (active) setNotice(error instanceof Error ? error.message : "تعذر تحميل المحادثة.");
      }).finally(() => { if (active) setLoading(false); });
    };
    load();
    // Keep incoming messages and read receipts current while this conversation is open.
    const interval = setInterval(load, 6000);
    return () => { active = false; clearInterval(interval); };
  }, [refresh]);

  const canSend = useMemo(() => draft.trim().length > 0 && draft.trim().length <= 500 && !sending, [draft, sending]);

  const send = async () => {
    const body = draft.trim();
    if (!canSend) return;
    setSending(true);
    setNotice("");
    try {
      await sendPlayerMessage(playerId, body);
      setDraft("");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر إرسال الرسالة.");
    } finally {
      setSending(false);
    }
  };

  const block = () => Alert.alert("حظر اللاعب", "لن يتمكن أي منكما من إرسال رسائل للآخر بعد الحظر.", [
    { text: "إلغاء", style: "cancel" },
    { text: "حظر", style: "destructive", onPress: () => {
      void blockPlayer(playerId).then(() => router.back()).catch((error) => setNotice(error instanceof Error ? error.message : "تعذر حظر اللاعب."));
    } },
  ]);

  const report = () => Alert.alert("الإبلاغ عن اللاعب", "اختر سبب الإبلاغ.", [
    { text: "رسائل مزعجة", onPress: () => void submitReport("spam") },
    { text: "مضايقة", onPress: () => void submitReport("harassment") },
    { text: "محتوى غير مناسب", onPress: () => void submitReport("inappropriate") },
    { text: "سبب آخر", onPress: () => void submitReport("other") },
    { text: "إلغاء", style: "cancel" },
  ]);

  const submitReport = async (reason: "spam" | "harassment" | "inappropriate" | "other") => {
    try {
      await reportPlayer(playerId, reason);
      setNotice("تم إرسال البلاغ للمراجعة.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر إرسال البلاغ.");
    }
  };

  return <AppScreen scroll={false}>
    <View style={styles.content}>
      <PageTitle eyebrow="رسائل اللاعبين" title={profile?.display_name ?? "المحادثة"} subtitle="يمكنك مراسلة اللاعبين حتى دون إضافتهم للأصدقاء." />
      <View style={styles.safetyRow}>
        <AppButton label="إبلاغ" icon="flag-outline" variant="secondary" small onPress={report} />
        <AppButton label="حظر" icon="ban-outline" variant="danger" small onPress={block} />
        <AppButton label="تحديث" icon="refresh-outline" variant="ghost" small onPress={() => void refresh().catch((e) => setNotice(e instanceof Error ? e.message : "تعذر التحديث."))} />
      </View>
      <Card style={styles.safetyNote}>
        <Icon name="shield-checkmark-outline" color={palette.jade} size={18} />
        <Txt style={styles.safetyText}>لا تشارك بياناتك الشخصية أو معلومات التواصل الخاصة. استخدم الحظر والإبلاغ إذا أزعجك أحد.</Txt>
      </Card>
      {notice ? <Card style={styles.notice}><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}
      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesInner} keyboardShouldPersistTaps="handled">
        {loading ? <Txt muted>جارٍ تحميل المحادثة...</Txt> : messages.length ? messages.map((message) => {
          const mine = message.sender_id === user?.id;
          return <View key={message.id} style={[styles.messageWrap, mine ? styles.mine : styles.theirs]}>
            <View style={[styles.messageBubble, mine ? styles.mineBubble : styles.theirBubble]}>
              <Txt style={styles.messageText}>{message.body}</Txt>
              <Txt muted style={styles.timestamp}>{new Date(message.created_at).toLocaleString("ar")}</Txt>
            </View>
          </View>;
        }) : <View style={styles.empty}><Icon name="chatbubble-ellipses-outline" size={28} color={palette.dim} /><Txt muted>ابدأ المحادثة برسالة محترمة.</Txt></View>}
      </ScrollView>
      <Card style={styles.composer}>
        <View style={styles.composerMeta}><Txt muted style={styles.counter}>{draft.trim().length}/500</Txt><Pill label="رسالة خاصة" tone="jade" /></View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="اكتب رسالتك..."
          placeholderTextColor={palette.muted}
          multiline
          maxLength={500}
          textAlign="right"
          style={styles.input}
          accessibilityLabel="نص الرسالة"
        />
        <AppButton label="إرسال الرسالة" icon="send" onPress={send} loading={sending} disabled={!canSend || !profile} />
      </Card>
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: 10, width: "100%", paddingBottom: 12 },
  safetyRow: { flexDirection: "row", gap: 7, justifyContent: "flex-start" },
  safetyNote: { padding: 10, flexDirection: "row", alignItems: "center", gap: 8, borderColor: "rgba(98,216,195,0.24)" },
  safetyText: { flex: 1, fontSize: 11, lineHeight: 17 },
  notice: { padding: 10 },
  noticeText: { color: palette.gold, fontSize: 11 },
  messages: { flex: 1, minHeight: 180 },
  messagesInner: { gap: 9, paddingVertical: 8 },
  messageWrap: { width: "100%", flexDirection: "row" },
  mine: { justifyContent: "flex-start" },
  theirs: { justifyContent: "flex-end" },
  messageBubble: { maxWidth: "84%", borderRadius: 15, paddingHorizontal: 12, paddingVertical: 9, gap: 5 },
  mineBubble: { backgroundColor: "#21443F", borderBottomLeftRadius: 4 },
  theirBubble: { backgroundColor: palette.panelRaised, borderBottomRightRadius: 4 },
  messageText: { fontSize: 13, lineHeight: 19 },
  timestamp: { fontSize: 9 },
  empty: { alignItems: "center", justifyContent: "center", gap: 8, padding: 30 },
  composer: { padding: 11, gap: 8 },
  composerMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  counter: { fontSize: 10 },
  input: { minHeight: 55, maxHeight: 110, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.midnight, color: palette.text, writingDirection: "rtl" },
});
