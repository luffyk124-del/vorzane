import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

export const SUPABASE_URL = "https://incidgigfqyjbqfegukg.supabase.co";
// Publishable client key only. Row-level security, not client secrecy, protects player rows.
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_scnWGsc4XJwq_ChOVUEHzQ_-obp7wV4";

const serverRendering = Platform.OS === "web" && typeof window === "undefined";
const authStorage = {
  getItem: (key: string) => serverRendering ? Promise.resolve(null) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => serverRendering ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) => serverRendering ? Promise.resolve() : AsyncStorage.removeItem(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
