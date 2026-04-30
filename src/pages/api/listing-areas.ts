import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanArea(value: string) {
  return String(value || "")
    .replace(/^na\s+/i, "")
    .trim();
}

function getListingAreaName(listing: any) {
  const raw =
    listing?.area ||
    listing?.normalized_area ||
    listing?.raw?.details?.subArea ||
    listing?.details?.subArea ||
    listing?.raw?.details?.area ||
    listing?.details?.area ||
    "";

  return cleanArea(raw);
}

export const GET: APIRoute = async ({ url }) => {
  const city = url.searchParams.get("city") || "";
  const searchKey = city.toLowerCase();

  if (!searchKey) {
    return new Response(JSON.stringify({ ok: true, areas: [] }));
  }

  const { data, error } = await supabase
    .from("listing_snapshots")
    .select("listings")
    .eq("search_key", searchKey)
    .single();

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500
    });
  }

  const listings = data?.listings || [];

  const areas = Array.from(
    new Set(
      listings
        .map((listing) => getListingAreaName(listing))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  return new Response(JSON.stringify({ ok: true, areas }));
};