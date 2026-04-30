import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  const shortlistSlug = String(body?.shortlistSlug || "").trim();
  const vendorIds = Array.isArray(body?.vendorIds) ? body.vendorIds : [];

  if (!shortlistSlug) {
    return new Response(JSON.stringify({ error: "Missing shortlistSlug" }), { status: 400 });
  }

  await supabase
    .from("shortlist_resource_vendors")
    .delete()
    .eq("shortlist_slug", shortlistSlug);

  if (vendorIds.length) {
    const rows = vendorIds.map((vendorId: string, index: number) => ({
      shortlist_slug: shortlistSlug,
      vendor_id: vendorId,
      is_selected: true,
      sort_order: index + 1,
    }));

    const { error } = await supabase
      .from("shortlist_resource_vendors")
      .insert(rows);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};