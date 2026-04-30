import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async () => {
  const { data, error } = await supabase
    .from("listing_snapshots")
    .select("listings")
    .eq("search_key", "nanaimo")
    .single();

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500
    });
  }

  const listings = data?.listings || [];

  const sample = listings.slice(0, 50).map((l: any) => ({
    id: l.id,
    address: l.address,
    city: l.city,

    area: l.raw?.address?.area,
    neighborhood: l.raw?.address?.neighborhood,
    community: l.raw?.address?.community,

    propertyType: l.raw?.details?.propertyType,
    propertySubType: l.raw?.details?.propertySubType,
    style: l.raw?.details?.style
  }));

  return new Response(
    JSON.stringify({
      ok: true,
      total: listings.length,
      sample
    }),
    { status: 200 }
  );
};