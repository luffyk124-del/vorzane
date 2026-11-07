import { Tabs, Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Icon, type IconName } from "../../src/components/ui";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

const tabIcons: Record<string, IconName> = {
  home: "home-outline",
  expeditions: "compass-outline",
  gear: "shield-outline",
  quests: "trophy-outline",
  settings: "settings-outline",
};

export default function TabLayout() {
  const { user, loading } = useAuth();
  const { status } = useGame();
  if (loading || status === "loading") return <View style={{ flex: 1, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={palette.jade} size="large" /></View>;
  if (!user || status === "auth") return <Redirect href="/login" />;
  if (status === "migration" || status === "conflict") return <Redirect href="/migration" />;

  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: palette.jade,
    tabBarInactiveTintColor: palette.dim,
    tabBarStyle: { height: 77, paddingTop: 9, paddingBottom: 12, backgroundColor: "#0D141E", borderTopColor: "rgba(214,232,232,0.10)", borderTopWidth: 1 },
    tabBarLabelStyle: { fontSize: 10, fontWeight: "800", marginTop: 2 },
    tabBarIcon: ({ color, size, focused }) => <Icon name={tabIcons[route.name] ?? "ellipse-outline"} size={focused ? size + 1 : size} color={typeof color === "string" ? color : palette.dim} />,
    sceneStyle: { backgroundColor: palette.ink },
  })}>
    <Tabs.Screen name="home" options={{ title: "المخيم" }} />
    <Tabs.Screen name="expeditions" options={{ title: "الرحلات" }} />
    <Tabs.Screen name="gear" options={{ title: "العتاد" }} />
    <Tabs.Screen name="quests" options={{ title: "السجل" }} />
    <Tabs.Screen name="settings" options={{ title: "الإعدادات" }} />
  </Tabs>;
}
