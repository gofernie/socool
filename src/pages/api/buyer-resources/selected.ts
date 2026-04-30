import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url }) => {
  const shortlistSlug = String(url.searchParams.get("shortlistSlug") || "").trim();

  if (!shortlistSlug) {
    return new Response(JSON.stringify({ vendorIds: [] }), { status: 200 });
  }

  const { data, error } = await supabase
    .from("shortlist_resource_vendors")
    .select("vendor_id")
    .eq("shortlist_slug", shortlistSlug)
    .eq("is_selected", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message, vendorIds: [] }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      vendorIds: (data || []).map((row) => row.vendor_id),
    }),
    { status: 200 }
  );
};