import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const getSupabase = () => createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { data, error } = await getSupabase().from("agents").insert(body).select().single();
  return new Response(JSON.stringify({ ok: !error, agent: data, error: error?.message }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  const { id } = await request.json();
  const { error } = await getSupabase().from("agents").delete().eq("id", id);
  return new Response(JSON.stringify({ ok: !error, error: error?.message }), {
    headers: { "Content-Type": "application/json" },
  });
};