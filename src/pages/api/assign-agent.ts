import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request }) => {
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { session_id, agent_id } = await request.json();
  const { error } = await supabase
    .from("intent_sessions")
    .upsert({ session_id, assigned_agent_id: agent_id || null }, { onConflict: "session_id" });
  return new Response(JSON.stringify({ ok: !error, error: error?.message }), {
    headers: { "Content-Type": "application/json" },
  });
};