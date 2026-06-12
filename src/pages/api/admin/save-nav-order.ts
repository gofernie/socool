import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!items.length) {
    return new Response(JSON.stringify({ ok: false, error: "No items provided" }), {
      status: 400,
    });
  }

  for (const item of items) {
    await supabase
      .from("intent_pages")
      .update({ sort_order: Number(item.sort_order) })
      .eq("id", item.id);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};