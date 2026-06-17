import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { session_id, notes } = await request.json();

    if (!session_id) {
      return new Response(JSON.stringify({ ok: false, error: "Missing session_id" }), { status: 400 });
    }

  const { error } = await supabase
      .from("intent_sessions")
      .upsert(
        { session_id, notes, updated_at: new Date().toISOString() },
        { onConflict: "session_id" }
      );

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Unknown error" }),
      { status: 500 }
    );
  }
};