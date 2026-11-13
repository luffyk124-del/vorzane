import { Stack, Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

export default function TabLayout() {
  const { user, loading } = useAuth();
  const { status } = useGame();
  if (loading || status === "loading") return <View style={{ flex: 1, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={palette.jade} size="large" /></View>;
  if (!user || status === "auth") return <Redirect href="/login" />;
  if (status === "migration" || status === "conflict") return <Redirect href="/migration" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.ink }, animation: "slide_from_right" }}>
    <Stack.Screen name="home" />
    <Stack.Screen name="character" />
    <Stack.Screen name="expeditions" />
    <Stack.Screen name="dimas" />
    <Stack.Screen name="gear" />
    <Stack.Screen name="player-market" />
    <Stack.Screen name="quests" />
    <Stack.Screen name="profile" />
    <Stack.Screen name="friends" />
    <Stack.Screen name="notifications" />
    <Stack.Screen name="settings" />
  </Stack>;
}
