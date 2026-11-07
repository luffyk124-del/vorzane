import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useGame } from "../src/contexts/GameContext";
import { palette } from "../src/theme";

export default function IndexRoute() {
  const { user, loading } = useAuth();
  const { status } = useGame();
  if (loading || status === "loading") return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.ink }}><ActivityIndicator color={palette.jade} size="large" /></View>;
  if (!user || status === "auth") return <Redirect href="/login" />;
  if (status === "migration" || status === "conflict") return <Redirect href="/migration" />;
  return <Redirect href="/(tabs)/home" />;
}
