import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useGame } from "./GameContext";

const MUSIC = require("../../assets/audio/vorzane-quest-theme.mp3");

export default function MusicController() {
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);
  if (!clientReady) return null;
  return <ActiveMusicController />;
}

function ActiveMusicController() {
  const player = useAudioPlayer(MUSIC, { updateInterval: 1000 });
  const { state } = useGame();
  const unlocked = useRef(false);
  const enabled = state.settings.musicEnabled;
  const volume = Math.max(0, Math.min(1, state.settings.musicVolume / 100));

  useEffect(() => {
    player.loop = true;
  }, [player]);

  useEffect(() => {
    player.volume = enabled ? volume : 0;
    if (!enabled) {
      player.pause();
      return;
    }
    if (unlocked.current) void player.play();
  }, [player, enabled, volume]);

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const begin = () => {
        if (!enabled) return;
        unlocked.current = true;
        player.volume = volume;
        void player.play();
      };
      window.addEventListener("pointerdown", begin);
      window.addEventListener("keydown", begin);
      return () => {
        window.removeEventListener("pointerdown", begin);
        window.removeEventListener("keydown", begin);
      };
    }
    if (enabled) {
      void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).then(() => {
        unlocked.current = true;
        void player.play();
      }).catch(() => undefined);
    }
  }, [enabled, player, volume]);

  return null;
}
