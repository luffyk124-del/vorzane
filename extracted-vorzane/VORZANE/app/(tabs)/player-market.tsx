import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import type { EquipmentItem } from "../../src/game/model";
import { supabase } from "../../src/lib/supabase";
import { palette, rarityColor } from "../../src/theme";

type Listing = {
  listing_id: string;
  seller_id: string;
  seller_name: string;
  item_data: EquipmentItem;
  price: number;
  created_at: string;
};
type OwnListing = {
  id: string;
  item_id: string;
  item_data: EquipmentItem;
  price: number;
  created_at: string;
};
const NON_WEAPON_SLOTS = ["درع", "خوذة", "قفازات", "حذاء", "قلادة", "خاتم أول", "خاتم ثانٍ", "armor", "shield", "helmet", "gloves", "boots", "necklace", "ring"];

export default function PlayerMarketScreen() {
  const { user } = useAuth();
  const { state, flushNow, reloadCloud } = useGame();
  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<OwnListing[]>([]);
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [price, setPrice] = useState("");
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const sellableItems = useMemo(() => state.inventory.filter((item) => NON_WEAPON_SLOTS.includes(item.slot)), [state.inventory]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const [feed, own] = await Promise.all([
      supabase.rpc("list_market_listings", { p_limit: 50, p_before: null }),
      supabase.from("player_market_listings")
        .select("id,item_id,item_data,price,created_at")
        .eq("seller_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (feed.error) throw new Error(feed.error.message);
    if (own.error) throw new Error(own.error.message);
    setListings((feed.data ?? []) as Listing[]);
    setMine((own.data ?? []) as OwnListing[]);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void refresh().catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : "تعذر تحميل سوق اللاعبين.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const syncBeforeAction = async () => {
    const saved = await flushNow();
    if (!saved) throw new Error("لم نتمكن من مزامنة حفظك قبل تنفيذ العملية. حاول بعد عودة الاتصال.");
  };

  const createListing = async () => {
    if (!selectedItem) return;
    const amount = Number(price);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000) {
      setNotice("أدخل سعر عرض صحيحًا بين 1 و1,000,000,000 ذهب.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await syncBeforeAction();
      const { error } = await supabase.rpc("create_market_listing", {
        p_item_id: selectedItem.id,
        p_price: amount,
      });
      if (error) throw new Error(error.message);
      await reloadCloud();
      setSelectedItem(null);
      setPrice("");
      await refresh();
      setNotice("تم نشر عرضك في سوق اللاعبين.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر نشر العرض.");
    } finally {
      setBusy(false);
    }
  };

  const buy = (listing: Listing) => Alert.alert("تأكيد الشراء", `شراء ${listing.item_data.name} مقابل ${listing.price.toLocaleString("en-US")} ذهب؟`, [
    { text: "إلغاء", style: "cancel" },
    { text: "شراء", onPress: () => { void (async () => {
      setBusy(true);
      setNotice("");
      try {
        await syncBeforeAction();
        const { error } = await supabase.rpc("buy_market_listing", { p_listing_id: listing.listing_id });
        if (error) throw new Error(error.message);
        await reloadCloud();
        await refresh();
        setNotice("تم الشراء وإضافة القطعة إلى حقيبتك.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "تعذر إتمام الشراء.");
      } finally { setBusy(false); }
    })(); } },
  ]);

  const cancel = (listing: OwnListing) => Alert.alert("إلغاء العرض", `إعادة ${listing.item_data.name} إلى حقيبتك؟`, [
    { text: "رجوع", style: "cancel" },
    { text: "إلغاء العرض", style: "destructive", onPress: () => { void (async () => {
      setBusy(true);
      setNotice("");
      try {
        await syncBeforeAction();
        const { error } = await supabase.rpc("cancel_market_listing", { p_listing_id: listing.id });
        if (error) throw new Error(error.message);
        await reloadCloud();
        await refresh();
        setNotice("أُلغي العرض وأُعيدت القطعة إلى حقيبتك.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "تعذر إلغاء العرض.");
      } finally { setBusy(false); }
    })(); } },
  ]);

  const renderItem = (item: EquipmentItem, listingPrice?: number, seller?: string, action?: ReactNode) => (
    <Card key={item.id + (seller ?? "")} style={styles.itemCard}>
      <View style={styles.itemAction}>{action}</View>
      <View style={styles.itemInfo}>
        <Txt style={[styles.itemName, { color: rarityColor[item.rarity] }]}>{item.name}</Txt>
        <Txt muted style={styles.itemMeta}>{item.slot} • {item.rarity}</Txt>
        <Txt style={styles.itemStats}>{Object.entries(item.bonus ?? {}).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ") || "قطعة عتاد"}</Txt>
        <Txt muted style={styles.canonicalPrice}>سعر المتجر: {Number(item.price ?? 0).toLocaleString("en-US")} ذهب</Txt>
        {seller ? <Txt muted style={styles.seller}>البائع: {seller}</Txt> : null}
        {listingPrice !== undefined ? <Txt style={styles.offerPrice}>سعر العرض: {listingPrice.toLocaleString("en-US")} ذهب</Txt> : null}
      </View>
      <Icon name="pricetag-outline" color={palette.jade} size={21} />
    </Card>
  );

  return <AppScreen>
    <View style={styles.content}>
      <PageTitle eyebrow="تجارة اللاعبين" title="سوق اللاعبين" subtitle="سوق مستقل لعروض اللاعبين، منفصل عن المتجر والسوق المحلي داخل اللعبة." trailing={<Pill label={`${state.gold.toLocaleString("en-US")} ذهب`} tone="gold" />} />
      <Card style={styles.noticeInfo}>
        <Icon name="shield-checkmark-outline" color={palette.jade} size={18} />
        <Txt style={styles.noticeInfoText}>العروض هنا تخص اللاعبين فقط. تتم عمليات البيع والشراء داخل الخادم بشكل ذري، وتُعرض القطع غير القتالية المسموح بتداولها فقط.</Txt>
      </Card>
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("browse")} style={[styles.tab, tab === "browse" && styles.tabActive]}><Txt style={[styles.tabText, tab === "browse" && styles.tabTextActive]}>تصفح العروض</Txt></Pressable>
        <Pressable onPress={() => setTab("mine")} style={[styles.tab, tab === "mine" && styles.tabActive]}><Txt style={[styles.tabText, tab === "mine" && styles.tabTextActive]}>عروضي ({mine.length})</Txt></Pressable>
      </View>
      {notice ? <Card style={styles.notice}><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}
      {tab === "browse" ? <>
        <SectionTitle title={`العروض المتاحة (${listings.length})`} icon="storefront-outline" action={<AppButton label="تحديث" icon="refresh-outline" variant="ghost" small onPress={() => void refresh().catch((e) => setNotice(e instanceof Error ? e.message : "تعذر التحديث."))} />} />
        {loading ? <Card style={styles.empty}><Txt muted>جارٍ تحميل العروض...</Txt></Card> : listings.length ? listings.map((listing) => renderItem(listing.item_data, listing.price, listing.seller_name, <AppButton label="شراء" icon="cart-outline" variant="jade" small disabled={busy || !state.hero} onPress={() => buy(listing)} />)) : <Card style={styles.empty}><Icon name="storefront-outline" size={25} color={palette.dim} /><Txt muted>لا توجد عروض متاحة الآن.</Txt></Card>}
      </> : <>
        <SectionTitle title={`عروضي النشطة (${mine.length})`} icon="pricetag-outline" />
        {mine.length ? mine.map((listing) => renderItem(listing.item_data, listing.price, "أنت", <AppButton label="إلغاء" icon="close-circle-outline" variant="danger" small disabled={busy} onPress={() => cancel(listing)} />)) : <Card style={styles.empty}><Txt muted>ما عندك عروض نشطة. اختر قطعة من حقيبتك لنشر عرض جديد.</Txt></Card>}
        <SectionTitle title="إضافة عرض جديد" icon="add-circle-outline" />
        {selectedItem ? <Card style={styles.listingForm}>
          <Txt style={styles.formTitle}>تسعير: {selectedItem.name}</Txt>
          <Txt muted style={styles.canonicalPrice}>سعر المتجر: {selectedItem.price.toLocaleString("en-US")} ذهب</Txt>
          <TextInput value={price} onChangeText={(value) => setPrice(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={10} placeholder="سعر العرض بالذهب" placeholderTextColor={palette.muted} style={styles.priceInput} />
          <View style={styles.formActions}>
            <AppButton label="نشر العرض" icon="cloud-upload-outline" onPress={createListing} loading={busy} disabled={busy || !state.hero} />
            <AppButton label="إلغاء" variant="secondary" onPress={() => { setSelectedItem(null); setPrice(""); }} disabled={busy} />
          </View>
        </Card> : null}
        {sellableItems.length ? sellableItems.map((item) => renderItem(item, undefined, undefined, <AppButton label={selectedItem?.id === item.id ? "محدد" : "اختيار"} small variant={selectedItem?.id === item.id ? "jade" : "secondary"} onPress={() => { setSelectedItem(item); setPrice(""); }} />)) : <Card style={styles.empty}><Txt muted>لا توجد قطع عتاد مؤهلة في حقيبتك حاليًا.</Txt></Card>}
      </>}
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: 12, width: "100%" },
  noticeInfo: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8, borderColor: "rgba(98,216,195,0.24)" },
  noticeInfoText: { flex: 1, fontSize: 11, lineHeight: 17 },
  tabs: { flexDirection: "row", gap: 6, padding: 4, borderRadius: 15, backgroundColor: palette.panel },
  tab: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: palette.gold },
  tabText: { color: palette.muted, fontSize: 12, fontWeight: "800" },
  tabTextActive: { color: palette.ink },
  notice: { padding: 10, borderColor: "rgba(230,199,124,0.3)" },
  noticeText: { color: palette.gold, fontSize: 11, textAlign: "right" },
  itemCard: { padding: 11, flexDirection: "row", alignItems: "center", gap: 9 },
  itemAction: { minWidth: 68, alignItems: "center" },
  itemInfo: { flex: 1, alignItems: "flex-end", gap: 3 },
  itemName: { fontSize: 13, fontWeight: "900" },
  itemMeta: { fontSize: 10 },
  itemStats: { color: palette.jade, fontSize: 10, fontWeight: "800" },
  canonicalPrice: { fontSize: 10 },
  offerPrice: { color: palette.gold, fontSize: 11, fontWeight: "900" },
  seller: { fontSize: 10 },
  empty: { padding: 20, gap: 8, alignItems: "center" },
  listingForm: { padding: 13, gap: 9 },
  formTitle: { fontSize: 14, fontWeight: "900" },
  priceInput: { minHeight: 48, borderWidth: 1, borderColor: palette.line, borderRadius: 12, paddingHorizontal: 12, color: palette.text, backgroundColor: palette.midnight, textAlign: "right" },
  formActions: { flexDirection: "row", gap: 8 },
});
