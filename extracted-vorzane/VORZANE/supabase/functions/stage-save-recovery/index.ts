import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_REQUEST_BYTES = 280 * 1024;
const MAX_SNAPSHOT_BYTES = 256 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RecoverySource = "legacy" | "offline";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function createStageSaveRecoveryHandler(
  makeClient: typeof createClient = createClient,
  getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name),
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authHeader = request.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceRoleKey) return json({ error: "Server configuration is incomplete" }, 500);

    let recoveryKey: string;
    let source: RecoverySource;
    let snapshot: Record<string, unknown>;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
        return json({ error: "Recovery snapshot is too large" }, 413);
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) ||
          Object.keys(parsed).some((key) => !["recoveryKey", "source", "snapshot"].includes(key)) ||
          typeof parsed.recoveryKey !== "string" || !UUID_PATTERN.test(parsed.recoveryKey) ||
          (parsed.source !== "legacy" && parsed.source !== "offline") ||
          !isRecord(parsed.snapshot)) {
        return json({ error: "Invalid recovery payload" }, 400);
      }
      const snapshotBytes = new TextEncoder().encode(JSON.stringify(parsed.snapshot)).byteLength;
      if (snapshotBytes > MAX_SNAPSHOT_BYTES) return json({ error: "Recovery snapshot is too large" }, 413);
      recoveryKey = parsed.recoveryKey;
      source = parsed.source;
      snapshot = parsed.snapshot;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // Verify the caller before any privileged database access.
    const caller = makeClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    // This endpoint only quarantines an untrusted snapshot. It deliberately
    // never reads or writes player_saves and never treats the payload as state.
    const admin = makeClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const row = {
      user_id: userData.user.id,
      recovery_key: recoveryKey,
      source,
      snapshot,
    };
    const { data: inserted, error: insertError } = await admin
      .from("player_save_recovery")
      .insert(row)
      .select("recovery_id, status")
      .maybeSingle();

    if (!insertError && inserted) {
      return json({ recoveryId: inserted.recovery_id, status: inserted.status, created: true, replayed: false });
    }

    // A repeated recovery key is idempotent. It returns the existing quarantine
    // record and does not replace the original snapshot with a newer payload.
    if (insertError?.code === "23505") {
      const { data: existing, error: readError } = await admin
        .from("player_save_recovery")
        .select("recovery_id, status")
        .eq("user_id", userData.user.id)
        .eq("recovery_key", recoveryKey)
        .maybeSingle();
      if (readError || !existing) return json({ error: "Could not verify staged recovery" }, 500);
      return json({ recoveryId: existing.recovery_id, status: existing.status, created: false, replayed: true });
    }

    return json({ error: "Could not stage recovery snapshot" }, 500);
  };
}

if (import.meta.main) {
  Deno.serve(createStageSaveRecoveryHandler());
}
