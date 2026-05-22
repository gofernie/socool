import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

function toNumber(value: any) {
  return parseInt(String(value || "").replace(/[^0-9]/g, ""), 10) || 0;
}

function normalizeSearchText(value: any) {
  return String(value || "").trim().toLowerCase();
}

function normalizeImageUrl(value: any) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("vreb/")) return `https://cdn.repliers.io/${url}`;
  if (url.startsWith("/vreb/")) return `https://cdn.repliers.io${url}`;
  if (url.startsWith("/")) return `https://cdn.repliers.io${url}`;
  return `https://cdn.repliers.io/${url}`;
}

function getBestImage(row: any) {
  return normalizeImageUrl(
    row.image_url || row.photo_url || row.thumbnail_url ||
    (Array.isArray(row.photo_urls) ? row.photo_urls[0] : "") ||
    (Array.isArray(row.images) ? row.images[0] : "")
  );
}

function normalizeImageArray(value: any) {
  const arr = Array.isArray(value) ? value : [];
  return arr.map((img: any) => {
    if (typeof img === "string") return normalizeImageUrl(img);
    return normalizeImageUrl(img?.url || img?.highRes || img?.mediumRes || img?.lowRes || "");
  }).filter(Boolean);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
  slug,
  maxPrice: clientMaxPrice,
  mode = "price"
} = body;

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), { status: 400 });
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: shortlist } = await supabase
      .from("shortlist_sends")
      .select("*")
      .eq("shortlist_slug", slug)
      .single();

    if (!shortlist) {
      return new Response(JSON.stringify({ ok: false, error: "Shortlist not found" }), { status: 404 });
    }

    const { data: existingItems } = await supabase
      .from("shortlist_items")
      .select("*")
      .eq("shortlist_send_id", shortlist.id);

    const rows = existingItems || [];

    if (!rows.length) {
      return new Response(JSON.stringify({ ok: false, error: "No existing listings" }), { status: 400 });
    }

    const sentIds = new Set(
      rows.flatMap((r: any) => [
        String(r.repliers_listing_id || "").trim(),
        String(r.mls_number || "").trim(),
      ]).filter(Boolean)
    );

    const first = rows[0];
    const city = normalizeSearchText(shortlist.search_city) ||
      normalizeSearchText(first.city) ||
      normalizeSearchText(first.normalized_city) ||
      "nanaimo";

    const type = normalizeSearchText(shortlist.search_type);
    const beds = toNumber(shortlist.search_beds);

    const typeMap: Record<string, string> = {
      detached: "house", home: "house", house: "house",
      condo: "condo", townhouse: "townhouse", land: "land", mobile: "mobile",
    };
    const mappedType = type ? (typeMap[type] || type) : "";

    const area = normalizeSearchText(shortlist.search_area) || "";
    const areas = area ? area.split(",").map((a: string) => a.trim().toLowerCase()).filter(Boolean) : [];

    const allPrices = rows.map((r: any) => toNumber(r.price_text || r.price)).filter((p: number) => p > 0);
    const currentMax = allPrices.length > 0 ? Math.max(...allPrices) : 0;

    // Hard cap: 15% above the highest price already seen
    const hardMaxPrice = currentMax ? Math.round(currentMax * 1.15) : 0;
    // Use client-supplied maxPrice if it's tighter, otherwise use our cap
    const effectiveMaxPrice = clientMaxPrice && clientMaxPrice < hardMaxPrice ? clientMaxPrice : hardMaxPrice;

    let baseQuery = supabase
      .from("listing_rows")
      .select("*")
      .eq("status", "A")
      .eq("normalized_city", city)
      .gte("price", currentMax)
      .order("price", { ascending: true })
      .limit(50);

    // Apply 15% price ceiling
    if (effectiveMaxPrice) {
      baseQuery = baseQuery.lte("price", effectiveMaxPrice);
    }

    if (areas.length === 1) baseQuery = baseQuery.eq("normalized_area", areas[0]);
    else if (areas.length > 1) baseQuery = baseQuery.in("normalized_area", areas);
    if (mappedType) baseQuery = baseQuery.eq("normalized_type", mappedType);

    let { data: candidates, error } = await baseQuery;

    if (error) throw error;

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: `No homes found between $${currentMax.toLocaleString()} and $${effectiveMaxPrice.toLocaleString()}.`,
      }), { status: 200 });
    }

    const next = candidates
      .filter((r: any) => {
        const rowId = String(r.id || "").trim();
        const mlsId = String(r.mls_number || "").trim();
        const repliersId = String(r.repliers_listing_id || "").trim();
        const ntype = String(r.normalized_type || "").toLowerCase();
        return rowId && !sentIds.has(rowId) && !sentIds.has(mlsId) && !sentIds.has(repliersId)
          && ntype !== "land" && ntype !== "mobile";
      })
      .sort((a: any, b: any) => {
        const aBedDiff = Math.abs(toNumber(a.beds) - beds);
        const bBedDiff = Math.abs(toNumber(b.beds) - beds);
        if (beds && aBedDiff !== bBedDiff) return aBedDiff - bBedDiff;
        return a.price - b.price;
      })
.slice(0, 5);
    if (!next.length) {
      return new Response(JSON.stringify({
        ok: false,
        error: `No unseen homes in the $${currentMax.toLocaleString()}–$${effectiveMaxPrice.toLocaleString()} range.`,
      }), { status: 200 });
    }

  const maxSortOrder = Math.max(...rows.map((r: any) => r.sort_order || 0), 0);

    const inserts = next.map((r: any, i: number) => {
      const gallery = normalizeImageArray(r.images || r.photo_urls);
      const imageUrl = getBestImage(r) || gallery[0] || "";
      return {
        shortlist_send_id: shortlist.id,
        listing_id: null,
        repliers_listing_id: String(r.id),
        sort_order: maxSortOrder + i + 1,
        address: r.address,
        price_text: `$${Number(r.price).toLocaleString()}`,
        image_url: imageUrl,
        images: gallery,
        photo_urls: gallery,
        beds: String(r.beds || ""),
        baths: String(r.baths || ""),
        sqft: String(r.sqft || ""),
        year_built: String(r.year_built || ""),
        property_type: r.normalized_type,
        description: r.description || "",
        is_new: true,
        source: "expand_search",
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from("shortlist_items")
      .insert(inserts)
      .select("*");

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      ok: true,
      added: inserted?.length || 0,
      listings: inserted || [],
    }), { status: 200 });

  } catch (err: any) {
    console.error("EXPAND SEARCH ERROR:", err);
    return new Response(JSON.stringify({
      ok: false,
      error: err.message || "Expand search failed",
    }), { status: 500 });
  }
};