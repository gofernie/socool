import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { id, lat, lng } = await request.json();

    if (!id || !lat || !lng) {
      return new Response(JSON.stringify({ ok: false }), { status: 400 });
    }

    await supabase
      .from("shortlist_items")
      .update({ lat, lng })
      .eq("repliers_listing_id", id);

    return new Response(JSON.stringify({ ok: true }));
  } catch (err) {
    return new Response(JSON.stringify({ ok: false }));
  }
};