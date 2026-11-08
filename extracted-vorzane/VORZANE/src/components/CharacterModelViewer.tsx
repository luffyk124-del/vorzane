import { createElement, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const MODEL_URL = "https://raw.githubusercontent.com/luffyk124-del/vorzane/main/assets/models/characters/vorzane-characters.glb";
const MODEL_VIEWER_SCRIPT = "https://cdn.jsdelivr.net/npm/@google/model-viewer/dist/model-viewer.min.js";

export function CharacterModelViewer() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (window.customElements?.get("model-viewer")) {
      setReady(true);
      return;
    }

    let script = document.querySelector<HTMLScriptElement>('script[data-vorzane-model-viewer="true"]');
    const onLoad = () => setReady(true);
    const onError = () => setFailed(true);

    if (!script) {
      script = document.createElement("script");
      script.type = "module";
      script.src = MODEL_VIEWER_SCRIPT;
      script.dataset.vorzaneModelViewer = "true";
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
    }

    return () => {
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, []);

  if (Platform.OS !== "web") {
    return <View style={styles.fallback}><Text style={styles.fallbackText}>معاينة المجسم ثلاثي الأبعاد متاحة في نسخة الويب حالياً.</Text></View>;
  }

  return <View style={styles.frame}>
    {createElement("model-viewer" as any, {
      src: MODEL_URL,
      alt: "مجسما شخصيتي VORZANE، الذكر والأنثى",
      "camera-controls": true,
      "auto-rotate": true,
      "rotation-per-second": "12deg",
      "shadow-intensity": "0.8",
      exposure: "1",
      "interaction-prompt": "none",
      style: {
        display: "block",
        width: "100%",
        height: "340px",
        background: "radial-gradient(ellipse at 50% 45%, #263c43 0%, #101b24 72%)",
        borderRadius: "16px",
      },
    })}
    {!ready && !failed ? <Text style={styles.status}>جارٍ تحميل المجسم ثلاثي الأبعاد…</Text> : null}
    {failed ? <Text style={styles.status}>تعذر تحميل عارض المجسم. تحقق من اتصال الإنترنت ثم أعد فتح الصفحة.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    minHeight: 340,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#101b24",
    position: "relative",
  },
  fallback: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#101b24",
  },
  fallbackText: { color: "#c7d1d4", textAlign: "center", fontSize: 13 },
  status: {
    position: "absolute",
    bottom: 10,
    right: 12,
    left: 12,
    color: "#d5dfdf",
    textAlign: "center",
    fontSize: 11,
    backgroundColor: "rgba(8, 15, 20, 0.78)",
    padding: 8,
    borderRadius: 8,
  },
});
