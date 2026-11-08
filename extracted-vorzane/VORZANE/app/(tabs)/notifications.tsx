import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { listMyNotifications, markAllNotificationsRead, markNotificationRead, type PlayerNotification } from "../../src/lib/social";
import { palette } from "../../src/theme";

export default function NotificationsScreen() {
  const [items, setItems] = useState<PlayerNotification[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const rows = await listMyNotifications();
    if (mountedRef.current) setItems(rows);
  }, []);

  useEffect(() => {
    void refresh().catch((error) => {
      if (mountedRef.current) setNotice(error instanceof Error ? error.message : "تعذر تحميل الإشعارات.");
    });
  }, [refresh]);

  const unread = items.filter((item) => !item.read_at).length;

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await refresh();
      if (mountedRef.current) setNotice(success);
    } catch (error) {
      if (mountedRef.current) setNotice(error instanceof Error ? error.message : "تعذر تحديث الإشعارات.");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const notificationText = (item: PlayerNotification) => item.notification_type === "friend_request"
    ? `أرسل لك ${item.actor_name} طلب صداقة.`
    : `وافق ${item.actor_name} على طلب صداقتك.`;

  return <AppScreen>
    <View style={styles.content}>
      <PageTitle
        eyebrow="تنبيهات المجتمع"
        title="الإشعارات"
        subtitle="طلبات الصداقة والتغييرات المهمة على حسابك."
        trailing={<Pill label={`${unread} غير مقروء`} tone={unread ? "gold" : "muted"} />}
      />
      {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.gold} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}
      <SectionTitle
        title={`صندوق الوارد (${items.length})`}
        icon="notifications-outline"
        action={<AppButton label="تحديث" icon="refresh-outline" variant="ghost" small onPress={() => run(refresh, "تم تحديث الإشعارات.")} disabled={busy} />}
      />
      {unread > 0 ? <AppButton label="تحديد الكل كمقروء" icon="checkmark-done-outline" variant="secondary" onPress={() => run(markAllNotificationsRead, "تم تحديد الإشعارات كمقروءة.")} disabled={busy} /> : null}
      {items.length ? items.map((item) => <Card key={item.notification_id} style={[styles.item, !item.read_at && styles.unread]}>
        <AppButton
          label={item.read_at ? "مقروء" : "تحديد كمقروء"}
          icon={item.read_at ? "checkmark-circle-outline" : "mail-open-outline"}
          variant={item.read_at ? "ghost" : "jade"}
          small
          disabled={busy || !!item.read_at}
          onPress={() => run(() => markNotificationRead(item.notification_id), "تم تحديث الإشعار.")}
        />
        <View style={styles.body}>
          <Txt style={styles.message}>{notificationText(item)}</Txt>
          <Txt muted style={styles.date}>{new Date(item.created_at).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}</Txt>
        </View>
        <View style={styles.icon}><Icon name={item.notification_type === "friend_request" ? "person-add-outline" : "people-outline"} color={item.read_at ? palette.muted : palette.gold} size={21} /></View>
      </Card>) : <Card style={styles.empty}><Icon name="notifications-off-outline" color={palette.muted} size={24} /><Txt muted>لا توجد إشعارات حتى الآن.</Txt></Card>}
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: 13, width: "100%" },
  item: { padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  unread: { borderColor: "rgba(230,199,124,0.48)", backgroundColor: "#17232A" },
  body: { flex: 1, alignItems: "flex-end", gap: 5 },
  message: { fontSize: 13, fontWeight: "800", textAlign: "right" },
  date: { fontSize: 10 },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#22343C" },
  empty: { padding: 22, alignItems: "center", gap: 10 },
  notice: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, fontSize: 11 },
});
