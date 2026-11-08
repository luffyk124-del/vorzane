// Slice 1 of docs/SERVER_AUTHORITY_SPEC.md: read path only.
// Returns the caller's own save. Writes are NOT handled here yet.
// RLS on player_saves still enforces ownership; this function adds a verified user check.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Client runs with the caller's JWT so RLS applies to every query.
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await client
    .from("player_saves")
    .select("game_state, updated_at")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) return json({ error: "Could not load save" }, 500);

  return json({
    state: data?.game_state ?? null,
    updatedAt: data?.updated_at ?? null,
  });
});
