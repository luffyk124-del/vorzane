import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, StatCard, Txt } from "../../src/components/ui";
import { DUNGEON_ITEM_POOL_SIZE, PETS, RARITY_LABELS, STARTER_ITEMS } from "../../src/game/catalog";
import { autoEquipBestGear, buyItem, buyPet, combatStats, equipItem, sellItem, setPet, unequipItem } from "../../src/game/engine";
import { DUNGEON_ITEMS, findEquipmentTemplate, getEquipmentSellPrice } from "../../src/game/dungeonItems";
import { SLOT_NAMES, type EquipmentItem } from "../../src/game/model";
import { rarityColor, palette } from "../../src/theme";
import { useGame } from "../../src/contexts/GameContext";

type Tab = "equipment" | "shop" | "market";
type ShopCategory = "all" | "weapons" | "armor" | "accessories" | "companions";
type InventoryCategory = "all" | "weapons" | "armor" | "accessories";
type InventorySort = "power" | "rarity" | "level";
type ShopSort = "level" | "rarity" | "power" | "price-low" | "price-high";
const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 } as const;
const BONUS_LABELS = { str: "قوة", def: "دفاع", vit: "حيوية", agi: "رشاقة", luck: "حظ" } as const;
const itemScore = (item: EquipmentItem) => Object.values(item.bonus).reduce((sum, value) => sum + (value ?? 0), 0);
const SHOP_CATEGORIES: { id: ShopCategory; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "weapons", label: "الأسلحة" },
  { id: "armor", label: "الدروع" },
  { id: "accessories", label: "الإكسسوارات" },
  { id: "companions", label: "الرفقاء" },
];
const slotIcons: Record<string, string> = { "سلاح": "flash", "درع": "shield", "خوذة": "skull", "قفازات": "hand-left", "حذاء": "footsteps", "قلادة": "diamond", "خاتم أول": "ellipse", "خاتم ثانٍ": "ellipse" };

export default function GearScreen() {
  const { state, update } = useGame();
  const [tab, setTab] = useState<Tab>("equipment");
  const [shopCategory, setShopCategory] = useState<ShopCategory>("all");
  const [inventoryCategory, setInventoryCategory] = useState<InventoryCategory>("all");
  const [inventorySort, setInventorySort] = useState<InventorySort>("power");
  const [shopSort, setShopSort] = useState<ShopSort>("power");
  const [notice, setNotice] = useState("");
  const stats = combatStats(state);
  const heroLevel = state.hero?.level ?? 0;
  const equippedCount = useMemo(() => Object.values(state.equipped).filter(Boolean).length, [state.equipped]);
  const shopItems = useMemo(() => [...STARTER_ITEMS, ...DUNGEON_ITEMS], []);
  const visibleShopItems = useMemo(() => {
    const filtered = shopCategory === "all" ? shopItems
      : shopCategory === "weapons" ? shopItems.filter((item) => item.slot === "سلاح")
      : shopCategory === "armor" ? shopItems.filter((item) => ["درع", "خوذة", "قفازات", "حذاء"].includes(item.slot))
      : shopCategory === "accessories" ? shopItems.filter((item) => ["قلادة", "خاتم أول", "خاتم ثانٍ"].includes(item.slot)) : [];
    return filtered.slice().sort((a, b) => {
      if (shopSort === "rarity") return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || itemScore(b) - itemScore(a);
      if (shopSort === "level") return (b.requiredLevel ?? 1) - (a.requiredLevel ?? 1) || itemScore(b) - itemScore(a);
      if (shopSort === "price-low") return a.price - b.price;
      if (shopSort === "price-high") return b.price - a.price;
      return itemScore(b) - itemScore(a);
    });
  }, [shopCategory, shopItems, shopSort]);
  const visiblePets = useMemo(() => PETS.slice().sort((a, b) => {
    const petScore = (bonus: Partial<Record<"str" | "def" | "vit" | "agi" | "luck", number>>) => Object.values(bonus).reduce((sum, value) => sum + (value ?? 0), 0);
    if (shopSort === "rarity") return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || petScore(b.bonus) - petScore(a.bonus);
    if (shopSort === "level") return b.requiredLevel - a.requiredLevel;
    if (shopSort === "price-low") return a.price - b.price;
    if (shopSort === "price-high") return b.price - a.price;
    return petScore(b.bonus) - petScore(a.bonus);
  }), [shopSort]);
  const marketItems = useMemo(() => [
    ...state.inventory.map((item) => ({ item, equipped: false })),
    ...Object.entries(state.equipped).flatMap(([slot, item]) => item ? [{ item, equipped: true, slot }] : []),
  ], [state.inventory, state.equipped]);
  const visibleInventory = useMemo(() => {
    const filtered = state.inventory.filter((item) => {
      if (inventoryCategory === "weapons") return item.slot === "سلاح";
      if (inventoryCategory === "armor") return ["درع", "خوذة", "قفازات", "حذاء"].includes(item.slot);
      if (inventoryCategory === "accessories") return ["قلادة", "خاتم أول", "خاتم ثانٍ"].includes(item.slot);
      return true;
    });
    return filtered.slice().sort((a, b) => {
      if (inventorySort === "rarity") return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || itemScore(b) - itemScore(a);
      if (inventorySort === "level") return (b.requiredLevel ?? 1) - (a.requiredLevel ?? 1) || itemScore(b) - itemScore(a);
      return itemScore(b) - itemScore(a);
    });
  }, [state.inventory, inventoryCategory, inventorySort]);
  const message = (text: string) => { setNotice(text); setTimeout(() => setNotice(""), 2400); };

  const purchaseItem = (id: string) => {
    const result = buyItem(state, id);
    if (result.error) { message(result.error); return; }
    update(() => result.state);
    message("أُضيف العتاد إلى حقيبتك.");
  };
  const purchasePet = (id: string) => {
    const result = buyPet(state, id);
    if (result.error) { message(result.error); return; }
    update(() => result.state);
    message("انضم رفيق جديد إلى رحلتك.");
  };
  const sellOwnedItem = (id: string) => {
    const result = sellItem(state, id);
    if (result.error) { message(result.error); return; }
    update(() => result.state);
    message(`تم البيع مقابل ${result.soldPrice} ذهب.`);
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "equipment", label: "عتادي", icon: "shield-checkmark" },
    { id: "shop", label: "المتجر", icon: "storefront-outline" },
    { id: "market", label: "السوق", icon: "cash-outline" },
  ];

  return <AppScreen>
    <PageTitle eyebrow="إدارة البطل" title="العتاد" subtitle="جهّز ما يلائمك، أو بع القطع الزائدة بسعر مرجعي عادل." trailing={<Pill label={`${state.gold.toLocaleString("en-US")} ذهب`} icon="cash-outline" tone="gold" />} />
    <View style={styles.statRow}>
      <StatCard label="القوة" value={stats.power} icon="fist" color={palette.gold} />
      <StatCard label="الهجوم" value={stats.attack} icon="sword" color={palette.red} />
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
      <SectionTitle title={`أماكن التجهيز (${equippedCount}/8)`} icon="grid-outline" action={<AppButton label="تجهيز أقوى العتاد" icon="shield-checkmark" onPress={() => { const next = autoEquipBestGear(state); const increase = combatStats(next).power - stats.power; update(() => next); message(increase > 0 ? `تم تجهيز أقوى العتاد؛ زادت قوة قتالك ${increase.toLocaleString("en-US")} نقطة.` : "لا توجد قطع مملوكة ومسموح بتجهيزها ترفع قوة القتال؛ تجهيزك الحالي هو الأفضل."); }} variant="jade" small />} />
      <View style={styles.slots}>
        {SLOT_NAMES.map((slot) => {
          const item = state.equipped[slot];
          const shown = item ? findEquipmentTemplate(item) ?? item : null;
          return <Card key={slot} style={styles.slotCard}>
            <View style={styles.slotHead}><Txt muted style={styles.slotName}>{slot}</Txt><Icon name={(slotIcons[slot] ?? "ellipse-outline") as never} size={17} color={palette.jade} /></View>
            {item && shown ? <>
              <Txt style={[styles.itemName, { color: rarityColor[shown.rarity] }]}>{shown.name}</Txt>
              <Txt muted style={styles.itemBonus}>{Object.entries(shown.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")} • سعر المتجر: {shown.price.toLocaleString("en-US")} ذهب</Txt>
              <Txt style={styles.requirement}>يتطلب مستوى {shown.requiredLevel ?? 1}{shown.requiredDungeonFloor && shown.requiredDungeonFloor > 1 ? ` • طابق ${shown.requiredDungeonFloor}` : ""}</Txt>
              <AppButton label={state.inventory.length >= 500 ? "الحقيبة ممتلئة" : "فكّ التجهيز"} onPress={() => update((current) => unequipItem(current, slot))} variant="ghost" small disabled={state.inventory.length >= 500} />
            </> : <Txt muted style={styles.emptySlot}>فارغ</Txt>}
          </Card>;
        })}
      </View>
      <SectionTitle title={`الحقيبة (${state.inventory.length})`} icon="file-tray-full-outline" action={<Pill label={`${visibleInventory.length} معروضة`} tone="jade" />} />
      <View style={styles.shopFilters}>
        {([{ id: "all", label: "الكل" }, { id: "weapons", label: "الأسلحة" }, { id: "armor", label: "الدروع" }, { id: "accessories", label: "الإكسسوارات" }] as const).map((filter) => <Pressable key={filter.id} onPress={() => setInventoryCategory(filter.id)} style={[styles.shopFilter, inventoryCategory === filter.id && styles.shopFilterActive]}>
          <Txt style={[styles.shopFilterText, inventoryCategory === filter.id && styles.shopFilterTextActive]}>{filter.label}</Txt>
        </Pressable>)}
      </View>
      <View style={styles.shopFilters}>
        {([{ id: "power", label: "الأقوى أولاً" }, { id: "rarity", label: "الندرة" }, { id: "level", label: "المستوى" }] as const).map((sort) => <Pressable key={sort.id} onPress={() => setInventorySort(sort.id)} style={[styles.sortChip, inventorySort === sort.id && styles.sortChipActive]}>
          <Txt style={[styles.sortChipText, inventorySort === sort.id && styles.sortChipTextActive]}>{sort.label}</Txt>
        </Pressable>)}
      </View>
      {visibleInventory.length ? visibleInventory.map((item) => {
        const template = findEquipmentTemplate(item);
        const shown = template ?? item;
        const locked = !template || !state.hero || heroLevel < (shown.requiredLevel ?? 1);
        const required = `مستوى ${shown.requiredLevel ?? 1}`;
        const equipped = state.equipped[shown.slot];
        const comparison = equipped ? (["str", "def", "vit", "agi", "luck"] as const).map((key) => ({ key, delta: (shown.bonus[key] ?? 0) - (equipped.bonus[key] ?? 0) })).filter((entry) => entry.delta !== 0) : [];
        return <Card key={item.id} style={styles.itemRow}>
          <AppButton label={locked ? "مقيّد" : "جهّز"} onPress={() => update((current) => equipItem(current, item.id))} variant={locked ? "secondary" : "jade"} small disabled={locked} />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Txt style={[styles.itemName, { color: rarityColor[shown.rarity] }]}>{shown.name}</Txt>
            <Txt muted style={styles.itemBonus}>{shown.slot} • {Object.entries(shown.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")} • سعر المتجر: {shown.price.toLocaleString("en-US")} ذهب</Txt>
            <Txt style={styles.requirement}>يتطلب {required}</Txt>
            <Txt style={styles.comparisonText}>{!equipped ? "فتحة التجهيز فارغة" : comparison.length ? `مقارنة مع ${equipped.name}: ${comparison.map(({ key, delta }) => `${BONUS_LABELS[key]} ${delta > 0 ? "+" : ""}${delta}`).join(" • ")}` : `مطابق لمكافآت ${equipped.name}`}</Txt>
          </View>
          <Icon name={(shown.icon ?? "ellipse") as never} color={rarityColor[shown.rarity]} size={20} />
        </Card>;
      }) : <Card style={styles.empty}><Icon name="file-tray-outline" color={palette.dim} size={22} /><Txt muted>{state.inventory.length ? "لا توجد قطع ضمن هذا التصنيف." : "حقيبتك فارغة. اختر أول قطعة من متجر العالم."}</Txt></Card>}
    </> : null}

    {tab === "shop" ? <>
      <SectionTitle title="متجر العالم" icon="storefront-outline" action={<Pill label={`${state.gold.toLocaleString("en-US")} ذهب`} icon="cash-outline" tone="gold" />} />
      <Card style={styles.shopIntro}><Txt style={styles.shopTitle}>كتالوج العتاد</Txt><Txt muted style={styles.shopCopy}>الأسلحة والدروع والخوذ والقفازات والأحذية والإكسسوارات والرفقاء متاحة بأسعار متدرجة. لا توجد قيود طوابق على العتاد؛ بعض القطع تتطلب مستوى مناسبًا للتجهيز فقط.</Txt><Txt style={styles.poolNote}>{shopItems.length.toLocaleString("en-US")} قطعة عتاد • {PETS.filter((pet) => pet.shopAvailable).length} رفقاء للشراء • {PETS.filter((pet) => !pet.shopAvailable).length} رفقاء حصريون</Txt></Card>
      <View style={styles.shopFilters}>
        {SHOP_CATEGORIES.map((category) => <Pressable key={category.id} onPress={() => setShopCategory(category.id)} style={[styles.shopFilter, shopCategory === category.id && styles.shopFilterActive]}>
          <Txt style={[styles.shopFilterText, shopCategory === category.id && styles.shopFilterTextActive]}>{category.label}</Txt>
        </Pressable>)}
      </View>
      <View style={styles.shopFilters}>
         {([{ id: "level", label: "المستوى" }, { id: "rarity", label: "الندرة" }, { id: "power", label: "القوة" }, { id: "price-low", label: "أقل سعر" }, { id: "price-high", label: "أعلى سعر" }] as const).map((sort) => <Pressable key={sort.id} onPress={() => setShopSort(sort.id)} style={[styles.sortChip, shopSort === sort.id && styles.sortChipActive]}>
           <Txt style={[styles.sortChipText, shopSort === sort.id && styles.sortChipTextActive]}>{sort.label}</Txt>
         </Pressable>)}
       </View>
       {visibleShopItems.map((item) => {
        const owned = state.inventory.some((ownedItem) => findEquipmentTemplate(ownedItem)?.id === item.id)
          || Object.values(state.equipped).some((ownedItem) => ownedItem ? findEquipmentTemplate(ownedItem)?.id === item.id : false);
        const canPurchase = !!state.hero && !owned;
        const levelLocked = heroLevel < (item.requiredLevel ?? 1);
        return <Card key={item.id} style={styles.itemRow}>
          <AppButton label={owned ? "مملوك" : "شراء"} onPress={() => purchaseItem(item.id)} variant={owned ? "secondary" : "jade"} small icon={owned ? "checkmark-circle-outline" : "cart-outline"} disabled={!canPurchase} />
          <View style={{ flex: 1, alignItems: "flex-end" }}><View style={styles.itemTitleLine}><Pill label={RARITY_LABELS[item.rarity]} tone={item.rarity === "legendary" || item.rarity === "mythic" ? "gold" : item.rarity === "epic" || item.rarity === "rare" ? "jade" : "muted"} /><Txt style={[styles.itemName, { color: rarityColor[item.rarity] }]}>{item.name}</Txt></View><Txt muted style={styles.itemBonus}>{item.slot} • {Object.entries(item.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")} • سعر المتجر: {item.price.toLocaleString("en-US")} ذهب</Txt><Txt style={[styles.requirement, levelLocked && { color: palette.red }]}>المستوى المطلوب للتجهيز: {item.requiredLevel ?? 1}</Txt></View>
          <Icon name={(item.icon ?? "ellipse") as never} color={rarityColor[item.rarity]} size={20} />
        </Card>;
      })}
      {shopCategory === "all" || shopCategory === "companions" ? <>
      <SectionTitle title="رفقاء العالم" icon="paw-outline" action={<Pill label={`${state.pets.length}/${PETS.length}`} tone="jade" />} />
      {visiblePets.map((pet) => {
        const owned = state.pets.includes(pet.id);
        const locked = !state.hero || heroLevel < pet.requiredLevel;
        const active = state.activePet === pet.id && !locked;
        return <Card key={pet.id} style={styles.petCard}>
          <View style={styles.petBadge}><Icon name={pet.icon as never} color={active ? palette.gold : palette.jade} size={23} /></View>
          <View style={{ flex: 1, alignItems: "flex-end" }}><View style={styles.petNameRow}>{active ? <Pill label="معك الآن" tone="gold" /> : <Pill label={pet.rarity === "mythic" ? "خرافي" : pet.rarity === "legendary" ? "أسطوري" : pet.rarity === "epic" ? "ملحمي" : "نادر"} tone="gold" />}<Txt style={styles.itemName}>{pet.name}</Txt></View><Txt muted style={styles.petDescription}>{pet.description}</Txt><Txt style={styles.petBonus}>{Object.entries(pet.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")} • سعر المتجر: {pet.price.toLocaleString("en-US")} ذهب</Txt><Txt style={[styles.requirement, locked && { color: palette.red }]}>المستوى المطلوب: {pet.requiredLevel}</Txt><Txt muted style={styles.petDescription}>مصدر الحصول: {pet.source}</Txt></View>
           {owned ? <AppButton label={active ? "النشط" : locked ? "المستوى غير كافٍ" : "تفعيل"} onPress={() => update((current) => setPet(current, pet.id))} variant={active ? "secondary" : "jade"} small disabled={active || locked} /> : pet.shopAvailable ? <AppButton label="شراء" onPress={() => purchasePet(pet.id)} variant="jade" small icon="cart-outline" /> : <Pill label="حصري • حدث / ديماس" tone="muted" />}
        </Card>;
      })}
      </> : null}
    </> : null}

    {tab === "market" ? <>
      <SectionTitle title={`سوق اللاعب (${marketItems.length})`} icon="cash-outline" action={<Pill label="50% من السعر المرجعي" tone="gold" />} />
      <Card style={styles.shopIntro}><Txt style={styles.shopTitle}>أسعار مرجعية واضحة</Txt><Txt muted style={styles.shopCopy}>يعرض السوق القطع الموجودة في حقيبتك أو المجهزة فقط. تُحسب قيمة البيع كنصف سعر الكتالوج، وتبقى غنائم الزنزانة خارج متجر الشراء.</Txt><Txt style={styles.poolNote}>كتالوج الزنزانة: {DUNGEON_ITEM_POOL_SIZE} قطعة • متاحة للشراء.</Txt></Card>
      {marketItems.length ? marketItems.map(({ item, equipped }) => {
        const shown = findEquipmentTemplate(item) ?? item;
        const sellPrice = getEquipmentSellPrice(item);
        return <Card key={`sale-${item.id}`} style={styles.itemRow}>
          <AppButton label={sellPrice === null ? "غير معتمد" : `بيع ${sellPrice}`} icon="cash-outline" onPress={() => sellOwnedItem(item.id)} variant={sellPrice === null ? "secondary" : "jade"} small disabled={sellPrice === null} />
          <View style={{ flex: 1, alignItems: "flex-end" }}><View style={styles.itemTitleLine}><Pill label={equipped ? "مجهّز" : RARITY_LABELS[shown.rarity]} tone={equipped ? "muted" : shown.rarity === "legendary" || shown.rarity === "mythic" ? "gold" : shown.rarity === "epic" || shown.rarity === "rare" ? "jade" : "muted"} /><Txt style={[styles.itemName, { color: rarityColor[shown.rarity] }]}>{shown.name}</Txt></View><Txt muted style={styles.itemBonus}>{shown.slot} • {Object.entries(shown.bonus).map(([key, value]) => `${key.toUpperCase()} +${value}`).join(" • ")}</Txt><Txt style={styles.requirement}>التجهيز: مستوى {shown.requiredLevel ?? 1}</Txt></View>
          <Icon name={(shown.icon ?? "ellipse") as never} color={rarityColor[shown.rarity]} size={20} />
        </Card>;
      }) : <Card style={styles.empty}><Icon name="pricetag-outline" color={palette.dim} size={22} /><Txt muted>لا توجد قطع للبيع الآن. انتصر في الزنزانة لتحصل على غنائم جديدة.</Txt></Card>}
    </> : null}


  </AppScreen>;
}

const styles = StyleSheet.create({
  statRow: { flexDirection: "row", gap: 8 },
  tabsCard: { padding: 5, flexDirection: "row", gap: 3, borderRadius: 17 },
  shopFilters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  shopFilter: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel },
  shopFilterActive: { backgroundColor: palette.gold, borderColor: palette.gold },
  shopFilterText: { color: palette.muted, fontSize: 11, fontWeight: "800" },
  shopFilterTextActive: { color: palette.ink },
  sortChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: "rgba(255,255,255,0.025)" },
  sortChipActive: { borderColor: palette.jade, backgroundColor: "rgba(98,216,195,0.10)" },
  sortChipText: { color: palette.muted, fontSize: 10, fontWeight: "800" },
  sortChipTextActive: { color: palette.jade },
  comparisonText: { color: palette.jade, fontSize: 9, lineHeight: 15, textAlign: "right", marginTop: 3 },
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
  shopPrice: { fontSize: 11, color: palette.gold, fontWeight: "900", marginTop: 2, textAlign: "right" },
  emptySlot: { fontSize: 12, marginTop: 7 },
  itemRow: { padding: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  empty: { padding: 20, gap: 9, alignItems: "center" },
  shopIntro: { gap: 6, backgroundColor: "#13242C" },
  shopTitle: { fontSize: 16, fontWeight: "900" },
  shopCopy: { fontSize: 12, lineHeight: 19 },
  poolNote: { fontSize: 11, color: palette.gold, fontWeight: "800" },
  itemTitleLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  petCard: { padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  petBadge: { width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(98,216,195,0.10)", alignItems: "center", justifyContent: "center" },
  petNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  petDescription: { fontSize: 11, lineHeight: 17, marginTop: 4, textAlign: "right" },
  petBonus: { color: palette.jade, fontSize: 10, fontWeight: "800", marginTop: 4 },
});
