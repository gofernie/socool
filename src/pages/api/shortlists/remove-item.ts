import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
  const { id } = await request.json();

  const { error } = await supabase
    .from("shortlist_items")
    .delete()
    .eq("id", id);

  return new Response(JSON.stringify({ ok: !error }));
};