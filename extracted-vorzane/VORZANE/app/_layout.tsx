import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold } from "@expo-google-fonts/tajawal";
import { AuthProvider } from "../src/contexts/AuthContext";
import { GameProvider } from "../src/contexts/GameContext";
import MusicController from "../src/contexts/MusicController";

export default function RootLayout() {
  useFonts({ Cinzel_700Bold, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold });
  return <SafeAreaProvider>
    <AuthProvider>
      <GameProvider>
        <MusicController />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="migration" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </GameProvider>
    </AuthProvider>
  </SafeAreaProvider>;
}
