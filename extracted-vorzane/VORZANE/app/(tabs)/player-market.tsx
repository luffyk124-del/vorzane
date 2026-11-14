import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
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

export default function PlayerMarketScreen() {
  const { user } = useAuth();
  const { state } = useGame();
  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<OwnListing[]>([]);
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

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
    setNotice("");
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void refresh().catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : "تعذر تحميل سوق اللاعبين.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const renderItem = (item: EquipmentItem, listingPrice: number, seller?: string) => (
    <Card key={item.id + (seller ?? "")} style={styles.itemCard}>
      <View style={styles.itemInfo}>
        <Txt style={[styles.itemName, { color: rarityColor[item.rarity] }]}>{item.name}</Txt>
        <Txt muted style={styles.itemMeta}>{item.slot} • {item.rarity}</Txt>
        <Txt style={styles.itemStats}>{Object.entries(item.bonus ?? {}).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ") || "قطعة عتاد"}</Txt>
        <Txt muted style={styles.canonicalPrice}>سعر المتجر: {Number(item.price ?? 0).toLocaleString("en-US")} ذهب</Txt>
        {seller ? <Txt muted style={styles.seller}>البائع: {seller}</Txt> : null}
        <Txt style={styles.offerPrice}>سعر العرض: {listingPrice.toLocaleString("en-US")} ذهب</Txt>
      </View>
      <Pill label="معاينة فقط" tone="muted" />
    </Card>
  );

  return <AppScreen>
    <View style={styles.content}>
      <PageTitle eyebrow="تجارة اللاعبين" title="سوق اللاعبين" subtitle="سوق مستقل عن متجر اللعبة وسوقها المحلي." trailing={<Pill label={`${state.gold.toLocaleString("en-US")} ذهب`} tone="gold" />} />
      <Card style={styles.noticeInfo}>
        <Icon name="lock-closed-outline" color={palette.gold} size={19} />
        <View style={styles.noticeCopy}>
          <Txt style={styles.noticeTitle}>التداول قيد التجهيز</Txt>
          <Txt style={styles.noticeInfoText}>السوق منفصل عن أسواق اللعبة. تصفح العروض متاح، لكن الشراء والبيع والإلغاء متوقفة حتى نكمل حماية ملكية القطع والذهب من جهة الخادم.</Txt>
        </View>
      </Card>
      <View style={styles.tabs}>
        <AppButton label="تصفح العروض" variant={tab === "browse" ? "jade" : "secondary"} onPress={() => setTab("browse")} />
        <AppButton label={`عروضي (${mine.length})`} variant={tab === "mine" ? "jade" : "secondary"} onPress={() => setTab("mine")} />
      </View>
      {notice ? <Card style={styles.notice}><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}
      {tab === "browse" ? <>
        <SectionTitle title={`العروض المتاحة (${listings.length})`} icon="storefront-outline" action={<AppButton label="تحديث" icon="refresh-outline" variant="ghost" small onPress={() => { setLoading(true); void refresh().catch((e) => setNotice(e instanceof Error ? e.message : "تعذر التحديث.")).finally(() => setLoading(false)); }} />} />
        {loading ? <Card style={styles.empty}><Txt muted>جارٍ تحميل العروض...</Txt></Card> : listings.length ? listings.map((listing) => renderItem(listing.item_data, listing.price, listing.seller_name)) : <Card style={styles.empty}><Icon name="storefront-outline" size={25} color={palette.dim} /><Txt muted>لا توجد عروض منشورة حاليًا.</Txt></Card>}
      </> : <>
        <SectionTitle title={`عروضي النشطة (${mine.length})`} icon="pricetag-outline" />
        {loading ? <Card style={styles.empty}><Txt muted>جارٍ تحميل عروضك...</Txt></Card> : mine.length ? mine.map((listing) => renderItem(listing.item_data, listing.price, "أنت")) : <Card style={styles.empty}><Icon name="lock-closed-outline" size={24} color={palette.gold} /><Txt muted>نشر العروض وإدارتها سيتاح بعد اكتمال حماية التداول.</Txt></Card>}
      </>}
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: 12, width: "100%", paddingBottom: 20 },
  noticeInfo: { padding: 12, flexDirection: "row", alignItems: "center", gap: 9, borderColor: "rgba(230,199,124,0.3)" },
  noticeCopy: { flex: 1, alignItems: "flex-end", gap: 4 },
  noticeTitle: { color: palette.gold, fontSize: 13, fontWeight: "900" },
  noticeInfoText: { fontSize: 11, lineHeight: 18, textAlign: "right" },
  tabs: { flexDirection: "row", gap: 8 },
  notice: { padding: 10, borderColor: "rgba(230,199,124,0.3)" },
  noticeText: { color: palette.gold, fontSize: 11, textAlign: "right" },
  itemCard: { padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  itemInfo: { flex: 1, alignItems: "flex-end", gap: 4 },
  itemName: { fontSize: 13, fontWeight: "900" },
  itemMeta: { fontSize: 10 },
  itemStats: { color: palette.jade, fontSize: 10, fontWeight: "800" },
  canonicalPrice: { fontSize: 10 },
  offerPrice: { color: palette.gold, fontSize: 11, fontWeight: "900" },
  seller: { fontSize: 10 },
  empty: { padding: 22, gap: 8, alignItems: "center" },
});
