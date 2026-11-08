import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, StatCard, Txt } from "../../src/components/ui";
import { DUNGEON_ITEM_POOL_SIZE, PETS, RARITY_LABELS, SHOP_ITEMS } from "../../src/game/catalog";
import { buyItem, buyPet, combatStats, equipItem, sellItem, setPet, unequipItem } from "../../src/game/engine";
import { findEquipmentTemplate, getEquipmentSellPrice } from "../../src/game/dungeonItems";
import { SLOT_NAMES, type Rarity } from "../../src/game/model";
import { rarityColor, palette } from "../../src/theme";
import { useGame } from "../../src/contexts/GameContext";

type Tab = "equipment" | "shop" | "market" | "companions";
type ShopSort = "recommended" | "price-asc" | "price-desc";
const SHOP_RARITY_FILTERS: { value: Rarity | "all"; label: string }[] = [
  { value: "all", label: "كل الندرات" }, { value: "common", label: "عادي" }, { value: "uncommon", label: "غير شائع" },
  { value: "rare", label: "نادر" }, { value: "epic", label: "ملحمي" },
];
const SHOP_SLOT_FILTERS = ["all", ...Array.from(new Set(SHOP_ITEMS.map((item) => item.slot)))];
const slotIcons: Record<string, string> = { "سلاح": "flash", "درع": "shield", "خوذة": "skull", "قفازات": "hand-left", "حذاء": "footsteps", "قلادة": "diamond", "خاتم أول": "ellipse", "خاتم ثانٍ": "ellipse" };

export default function GearScreen() {
  const { state, update, fpsMode, command } = useGame();
  const [tab, setTab] = useState<Tab>("equipment");
  const [notice, setNotice] = useState("");
  const [shopQuery, setShopQuery] = useState("");
  const [shopRarity, setShopRarity] = useState<Rarity | "all">("all");
  const [shopSlot, setShopSlot] = useState("all");
  const [shopSort, setShopSort] = useState<ShopSort>("recommended");
  const [shopLimit, setShopLimit] = useState(30);
  const stats = combatStats(state);
  const heroLevel = state.hero?.level ?? 0;
  const equippedCount = useMemo(() => Object.values(state.equipped).filter(Boolean).length, [state.equipped]);
  const marketItems = useMemo(() => [
    ...state.inventory.map((item) => ({ item, equipped: false })),
    ...Object.entries(state.equipped).flatMap(([slot, item]) => item ? [{ item, equipped: true, slot }] : []),
  ], [state.inventory, state.equipped]);
  const filteredShopItems = useMemo(() => {
    const query = shopQuery.trim().toLocaleLowerCase("ar");
    const result = SHOP_ITEMS.filter((item) => {
      const matchesQuery = !query || `${item.name} ${item.slot}`.toLocaleLowerCase("ar").includes(query);
      return matchesQuery && (shopRarity === "all" || item.rarity === shopRarity) && (shopSlot === "all" || item.slot === shopSlot);
    });
    if (shopSort === "price-asc") result.sort((a, b) => a.price - b.price);
    if (shopSort === "price-desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [shopQuery, shopRarity, shopSlot, shopSort]);
  useEffect(() => { setShopLimit(30); }, [shopQuery, shopRarity, shopSlot, shopSort]);
  const message = (text: string) => { setNotice(text); setTimeout(() => setNotice(""), 2400); };

  const purchaseItem = (id: string) => {
    if (fpsMode) { void command({ type: "buyItem", itemId: id }); return; }
    const result = buyItem(state, id);
    if (result.error) { message(result.error); return; }
    update(() => result.state);
    message("أُضيف العتاد إلى حقيبتك.");
  };
  const purchasePet = (id: string) => {
    if (fpsMode) { void command({ type: "buyPet", petId: id }); return; }
    const result = buyPet(state, id);
    if (result.error) { message(result.error); return; }
    update(() => result.state);
    message("انضم رفيق جديد إلى رحلتك.");
  };
  const sellOwnedItem = (id: string) => {
    if (fpsMode) { void command({ type: "sellItem", itemId: id }); return; }
    const result = sellItem(state, id);
    if (result.error) { message(result.error); return; }
    update(() => result.state);
    message(`تم البيع مقابل ${result.soldPrice} ذهب.`);
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "equipment", label: "عتادي", icon: "shield-checkmark" },
    { id: "shop", label: "المتجر", icon: "storefront-outline" },
    { id: "market", label: "السوق", icon: "cash-outline" },
    { id: "companions", label: "رفقاء", icon: "paw-outline" },
  ];

  return <AppScreen>
    <PageTitle eyebrow="إدارة البطل" title="العتاد" subtitle="جهّز ما يلائمك، أو بع القطع الزائدة بسعر مرجعي عادل." trailing={<Pill label={`${state.gold.toLocaleString("ar-EG")} ذهب`} icon="cash-outline" tone="gold" />} />
    <View style={styles.statRow}>
      <StatCard label="القوة" value={stats.power} icon="flash" color={palette.gold} />
      <StatCard label="الهجوم" value={stats.attack} icon="flash-outline" color={palette.red} />
      <StatCard label="الدفاع" value={stats.defense} icon="shield-checkmark" color={palette.blue} />
    </View>
    <Card style={styles.tabsCard}>
      {tabs.map((item) => <Pressable key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, tab === item.id && styles.tabActive]}>
        <Icon name={item.icon as never} size={15} color={tab === item.id ? palette.ink : palette.muted} />
        <Txt style={[styles.tabText, tab === item.id && { color: palette.ink }]}>{item.label}</Txt>
      </Pressable>)}
    </Card>
    {notice ? <Card style={styles.notice}><Icon name="checkmark-circle" color={palette.jade} size={17} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}

    {tab === "equipment" ? <>
      <SectionTitle title={`أماكن التجهيز (${equippedCount}/8)`} icon="grid-outline" />
      <View style={styles.slots}>
        {SLOT_NAMES.map((slot) => {
          const item = state.equipped[slot];
          const shown = item ? findEquipmentTemplate(item) ?? item : null;
          return <Card key={slot} style={styles.slotCard}>
            <View style={styles.slotHead}><Txt muted style={styles.slotName}>{slot}</Txt><Icon name={(slotIcons[slot] ?? "ellipse-outline") as never} size={17} color={palette.jade} /></View>
            {item && shown ? <>
              <Txt style={[styles.itemName, { color: rarityColor[shown.rarity] }]}>{shown.name}</Txt>
              <Txt muted style={styles.itemBonus}>{Object.entries(shown.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")}</Txt>
              <Txt style={styles.requirement}>يتطلب مستوى {shown.requiredLevel ?? 1}{shown.requiredDungeonFloor && shown.requiredDungeonFloor > 1 ? ` • طابق ${shown.requiredDungeonFloor}` : ""}</Txt>
              <AppButton label="فكّ التجهيز" onPress={() => fpsMode ? void command({ type: "unequipItem", slot }) : update((current) => unequipItem(current, slot))} variant="ghost" small />
            </> : <Txt muted style={styles.emptySlot}>فارغ</Txt>}
          </Card>;
        })}
      </View>
      <SectionTitle title={`الحقيبة (${state.inventory.length})`} icon="file-tray-full-outline" />
      {state.inventory.length ? state.inventory.map((item) => {
        const template = findEquipmentTemplate(item);
        const shown = template ?? item;
        const locked = !template || !state.hero || heroLevel < (shown.requiredLevel ?? 1) || state.dungeonFloor < (shown.requiredDungeonFloor ?? 1);
        const required = `مستوى ${shown.requiredLevel ?? 1}${shown.requiredDungeonFloor && shown.requiredDungeonFloor > 1 ? ` • طابق ${shown.requiredDungeonFloor}` : ""}`;
        return <Card key={item.id} style={styles.itemRow}>
          <AppButton label={locked ? "مقيّد" : "جهّز"} onPress={() => fpsMode ? void command({ type: "equipItem", itemId: item.id }) : update((current) => equipItem(current, item.id))} variant={locked ? "secondary" : "jade"} small disabled={locked} />
          <View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={[styles.itemName, { color: rarityColor[shown.rarity] }]}>{shown.name}</Txt><Txt muted style={styles.itemBonus}>{shown.slot} • {Object.entries(shown.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")}</Txt><Txt style={styles.requirement}>يتطلب {required}</Txt></View>
          <Icon name={(shown.icon ?? "ellipse") as never} color={rarityColor[shown.rarity]} size={20} />
        </Card>;
      }) : <Card style={styles.empty}><Icon name="file-tray-outline" color={palette.dim} size={22} /><Txt muted>حقيبتك فارغة. اكسب عتادًا من الزنزانة أو ابدأ بمتجر الحدود.</Txt></Card>}
    </> : null}

    {tab === "shop" ? <>
      <SectionTitle title="متجر الحدود" icon="storefront-outline" action={<Pill label={`${state.gold.toLocaleString("ar-EG")} ذهب`} icon="cash-outline" tone="gold" />} />
      <Card style={styles.shopIntro}><Txt style={styles.shopTitle}>كتالوج العتاد</Txt><Txt muted style={styles.shopCopy}>199 قطعة: 7 قطع بداية و192 قطعة جديدة. ابحث وصفِّ حسب الندرة ومكان التجهيز والسعر. العتاد الأسطوري والخرافي حكر على الزنزانات.</Txt>
        <TextInput value={shopQuery} onChangeText={setShopQuery} placeholder="ابحث عن اسم القطعة أو نوعها..." placeholderTextColor={palette.muted} style={styles.shopSearch} accessibilityLabel="البحث في المتجر" />
        <Txt muted style={styles.filterLabel}>الندرة</Txt>
        <View style={styles.filterRow}>{SHOP_RARITY_FILTERS.map((filter) => <Pressable key={filter.value} onPress={() => setShopRarity(filter.value)} style={[styles.filterChip, shopRarity === filter.value && styles.filterChipActive]}><Txt style={[styles.filterChipText, shopRarity === filter.value && styles.filterChipTextActive]}>{filter.label}</Txt></Pressable>)}</View>
        <Txt muted style={styles.filterLabel}>مكان التجهيز</Txt>
        <View style={styles.filterRow}>{SHOP_SLOT_FILTERS.map((slot) => <Pressable key={slot} onPress={() => setShopSlot(slot)} style={[styles.filterChip, shopSlot === slot && styles.filterChipActive]}><Txt style={[styles.filterChipText, shopSlot === slot && styles.filterChipTextActive]}>{slot === "all" ? "الكل" : slot}</Txt></Pressable>)}</View>
        <Txt muted style={styles.filterLabel}>الترتيب</Txt>
        <View style={styles.filterRow}>
          {([{ value: "recommended", label: "المقترح" }, { value: "price-asc", label: "الأقل سعرًا" }, { value: "price-desc", label: "الأعلى سعرًا" }] as const).map((sort) => <Pressable key={sort.value} onPress={() => setShopSort(sort.value)} style={[styles.filterChip, shopSort === sort.value && styles.filterChipActive]}><Txt style={[styles.filterChipText, shopSort === sort.value && styles.filterChipTextActive]}>{sort.label}</Txt></Pressable>)}
        </View>
        <Txt style={styles.poolNote}>يعرض {Math.min(shopLimit, filteredShopItems.length)} من {filteredShopItems.length} قطعة مطابقة</Txt>
      </Card>
      {filteredShopItems.length ? filteredShopItems.slice(0, shopLimit).map((item) => {
        const locked = !state.hero || heroLevel < (item.requiredLevel ?? 1);
        return <Card key={item.id} style={styles.itemRow}>
        <AppButton label={locked ? `يتطلب المستوى ${item.requiredLevel ?? 1}` : `${item.price} ذهب`} onPress={() => purchaseItem(item.id)} variant={locked ? "secondary" : "jade"} small icon={locked ? "lock-closed-outline" : "cart-outline"} disabled={locked} />
        <View style={{ flex: 1, alignItems: "flex-end" }}><View style={styles.itemTitleLine}><Pill label={RARITY_LABELS[item.rarity]} tone={item.rarity === "legendary" || item.rarity === "mythic" ? "gold" : item.rarity === "epic" || item.rarity === "rare" ? "jade" : "muted"} /><Txt style={[styles.itemName, { color: rarityColor[item.rarity] }]}>{item.name}</Txt></View><Txt muted style={styles.itemBonus}>{item.slot} • {Object.entries(item.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")}</Txt><Txt style={styles.requirement}>يفتح من المستوى {item.requiredLevel ?? 1}</Txt></View>
        <Icon name={(item.icon ?? "ellipse") as never} color={rarityColor[item.rarity]} size={20} />
      </Card>;
      }) : <Card style={styles.empty}><Txt muted>لا توجد عناصر تطابق البحث والفلاتر الحالية.</Txt></Card>}
      {filteredShopItems.length > shopLimit ? <AppButton label="عرض 30 قطعة إضافية" onPress={() => setShopLimit((limit) => limit + 30)} variant="secondary" /> : null}
    </> : null}

    {tab === "market" ? <>
      <SectionTitle title={`سوق اللاعب (${marketItems.length})`} icon="cash-outline" action={<Pill label="50% من السعر المرجعي" tone="gold" />} />
      <Card style={styles.shopIntro}><Txt style={styles.shopTitle}>أسعار مرجعية واضحة</Txt><Txt muted style={styles.shopCopy}>يعرض السوق القطع الموجودة في حقيبتك أو المجهزة فقط. تُحسب قيمة البيع كنصف سعر الكتالوج، وتبقى غنائم الزنزانة خارج متجر الشراء.</Txt><Txt style={styles.poolNote}>كتالوج الزنزانة: {DUNGEON_ITEM_POOL_SIZE} قطعة • لا تُشترى من المتجر.</Txt></Card>
      {marketItems.length ? marketItems.map(({ item, equipped }) => {
        const shown = findEquipmentTemplate(item) ?? item;
        const sellPrice = getEquipmentSellPrice(item);
        return <Card key={`sale-${item.id}`} style={styles.itemRow}>
          <AppButton label={sellPrice === null ? "غير معتمد" : `بيع ${sellPrice}`} icon="cash-outline" onPress={() => sellOwnedItem(item.id)} variant={sellPrice === null ? "secondary" : "jade"} small disabled={sellPrice === null} />
          <View style={{ flex: 1, alignItems: "flex-end" }}><View style={styles.itemTitleLine}><Pill label={equipped ? "مجهّز" : RARITY_LABELS[shown.rarity]} tone={equipped ? "muted" : shown.rarity === "legendary" || shown.rarity === "mythic" ? "gold" : shown.rarity === "epic" || shown.rarity === "rare" ? "jade" : "muted"} /><Txt style={[styles.itemName, { color: rarityColor[shown.rarity] }]}>{shown.name}</Txt></View><Txt muted style={styles.itemBonus}>{shown.slot} • {Object.entries(shown.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")}</Txt><Txt style={styles.requirement}>التجهيز: مستوى {shown.requiredLevel ?? 1}{shown.requiredDungeonFloor && shown.requiredDungeonFloor > 1 ? ` • طابق ${shown.requiredDungeonFloor}` : ""}</Txt></View>
          <Icon name={(shown.icon ?? "ellipse") as never} color={rarityColor[shown.rarity]} size={20} />
        </Card>;
      }) : <Card style={styles.empty}><Icon name="pricetag-outline" color={palette.dim} size={22} /><Txt muted>لا توجد قطع للبيع الآن. انتصر في الزنزانة لتحصل على غنائم جديدة.</Txt></Card>}
    </> : null}

    {tab === "companions" ? <>
      <SectionTitle title="رفقاء الرحلة" icon="paw-outline" action={<Pill label={`${state.pets.length}/${PETS.length}`} tone="jade" />} />
      <Card style={styles.shopIntro}><Txt style={styles.shopTitle}>لا تسافر وحيدًا</Txt><Txt muted style={styles.shopCopy}>كل رفيق يمنحك سمة مختلفة. رفيق واحد نشط في الوقت نفسه.</Txt></Card>
      {PETS.map((pet) => {
        const owned = state.pets.includes(pet.id);
        const locked = !state.hero || heroLevel < pet.requiredLevel;
        const active = state.activePet === pet.id && !locked;
        return <Card key={pet.id} style={styles.petCard}>
          <View style={styles.petBadge}><Icon name={pet.icon as never} color={active ? palette.gold : palette.jade} size={23} /></View>
          <View style={{ flex: 1, alignItems: "flex-end" }}><View style={styles.petNameRow}>{active ? <Pill label="معك الآن" tone="gold" /> : locked ? <Pill label={`مستوى ${pet.requiredLevel}`} tone="muted" /> : null}<Txt style={styles.itemName}>{pet.name}</Txt></View><Txt muted style={styles.petDescription}>{pet.description}</Txt><Txt style={styles.petBonus}>{Object.entries(pet.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")}</Txt><Txt style={styles.requirement}>يفتح من المستوى {pet.requiredLevel}</Txt></View>
          {owned ? <AppButton label={locked ? `مستوى ${pet.requiredLevel}` : active ? "النشط" : "اختر"} onPress={() => fpsMode ? void command({ type: "setPet", petId: pet.id }) : update((current) => setPet(current, pet.id))} variant={active ? "secondary" : "jade"} small disabled={active || locked} /> : <AppButton label={locked ? `يفتح مستوى ${pet.requiredLevel}` : `${pet.price} ذهب`} onPress={() => purchasePet(pet.id)} variant={locked ? "secondary" : "jade"} small icon={locked ? "lock-closed-outline" : "cart-outline"} disabled={locked} />}
        </Card>;
      })}
    </> : null}
  </AppScreen>;
}

const styles = StyleSheet.create({
  statRow: { flexDirection: "row", gap: 8 },
  tabsCard: { padding: 5, flexDirection: "row", gap: 3, borderRadius: 17 },
  tab: { flex: 1, minHeight: 43, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 },
  tabActive: { backgroundColor: palette.gold },
  tabText: { fontSize: 10, fontWeight: "800", color: palette.muted },
  notice: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8, borderColor: "rgba(98,216,195,0.25)" },
  noticeText: { flex: 1, fontSize: 12 },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotCard: { width: "48%", minHeight: 109, padding: 11, gap: 6 },
  slotHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  slotName: { fontSize: 10, fontWeight: "800" },
  itemName: { fontSize: 13, fontWeight: "900" },
  itemBonus: { fontSize: 10, lineHeight: 16, textAlign: "right" },
  requirement: { fontSize: 9, color: palette.gold, marginTop: 2, textAlign: "right" },
  emptySlot: { fontSize: 12, marginTop: 7 },
  itemRow: { padding: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  empty: { padding: 20, gap: 9, alignItems: "center" },
  shopIntro: { gap: 6, backgroundColor: "#13242C" },
  shopTitle: { fontSize: 16, fontWeight: "900" },
  shopCopy: { fontSize: 12, lineHeight: 19 },
  shopSearch: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, color: palette.text, textAlign: "right", backgroundColor: "#0B171D", marginTop: 7 },
  filterLabel: { fontSize: 10, fontWeight: "800", marginTop: 7, textAlign: "right" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#0B171D" },
  filterChipActive: { backgroundColor: palette.gold, borderColor: palette.gold },
  filterChipText: { fontSize: 10, color: palette.muted, fontWeight: "700" },
  filterChipTextActive: { color: palette.ink },
  poolNote: { fontSize: 11, color: palette.gold, fontWeight: "800" },
  itemTitleLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  petCard: { padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  petBadge: { width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(98,216,195,0.10)", alignItems: "center", justifyContent: "center" },
  petNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  petDescription: { fontSize: 11, lineHeight: 17, marginTop: 4, textAlign: "right" },
  petBonus: { color: palette.jade, fontSize: 10, fontWeight: "800", marginTop: 4 },
});
