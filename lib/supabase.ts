import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

// Configure these via app.json extra or environment in production.
const expoExtra =
  (Constants.expoConfig as any)?.extra ||
  (Constants.manifest as any)?.extra ||
  (globalThis as any).__expoConfig?.extra ||
  (globalThis as any).expo?.extra ||
  {};

const rawUrl =
  expoExtra.SUPABASE_URL || process.env.SUPABASE_URL || "<YOUR_SUPABASE_URL>";

const rawKey =
  expoExtra.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "<YOUR_SUPABASE_ANON_KEY>";

// Basic validation: ensure URL looks like http(s) and keys are not placeholder
export const SUPABASE_CONFIGURED =
  typeof rawUrl === "string" &&
  /^https?:\/\//i.test(rawUrl) &&
  rawKey &&
  !rawUrl.includes("<YOUR_") &&
  !rawKey.includes("<YOUR_");

let _supabase: SupabaseClient | null = null;
if (SUPABASE_CONFIGURED) {
  _supabase = createClient(rawUrl, rawKey);
}

// Export a nullable client; callers should check SUPABASE_CONFIGURED before using.
export const supabase: SupabaseClient | null = _supabase;
