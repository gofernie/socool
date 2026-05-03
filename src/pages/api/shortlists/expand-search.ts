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
  if (url.startsWith("/")) return `https://cdn.repliers.io${url}`;

  return `https://cdn.repliers.io/${url}`;
}

function getBestImage(row: any) {
  return normalizeImageUrl(
    row.image_url ||
      row.photo_url ||
      row.thumbnail_url ||
      (Array.isArray(row.photo_urls) ? row.photo_urls[0] : "") ||
      (Array.isArray(row.images) ? row.images[0] : "")
  );
}

function normalizeImageArray(value: any) {
  const arr = Array.isArray(value) ? value : [];

  return arr
    .map((img: any) => {
      if (typeof img === "string") return normalizeImageUrl(img);

      return normalizeImageUrl(
        img?.url || img?.highRes || img?.mediumRes || img?.lowRes || ""
      );
    })
    .filter(Boolean);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { slug } = await request.json();

    if (!slug) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing slug" }),
        { status: 400 }
      );
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
      return new Response(
        JSON.stringify({ ok: false, error: "Shortlist not found" }),
        { status: 404 }
      );
    }

    const { data: existingItems } = await supabase
      .from("shortlist_items")
      .select("*")
      .eq("shortlist_send_id", shortlist.id);

    const rows = existingItems || [];

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "No existing listings" }),
        { status: 400 }
      );
    }

 const sentIds = new Set(
  rows
    .map((r: any) => String(r.repliers_listing_id || "").trim())
    .filter(Boolean)
);

    const first = rows[0];

    const city =
      normalizeSearchText(shortlist.search_city) ||
      normalizeSearchText(first.city) ||
      normalizeSearchText(first.normalized_city);

    const area =
      normalizeSearchText(shortlist.search_area) ||
      normalizeSearchText(first.area) ||
      normalizeSearchText(first.normalized_area);

    const type =
      normalizeSearchText(shortlist.search_type) ||
      normalizeSearchText(first.property_type) ||
      normalizeSearchText(first.normalized_type);

    const beds =
      toNumber(shortlist.search_beds) ||
      Math.min(...rows.map((r: any) => toNumber(r.beds)).filter(Boolean));

const originalRows = rows.filter((r: any) => {
  const source = String(r.source || "").toLowerCase();
  return source !== "expand_search" && source !== "expanded" && source !== "better_matches";
});

const priceRows = originalRows.length ? originalRows : rows;

const prices = priceRows
  .map((r: any) => toNumber(r.price_text || r.price))
  .filter((p: number) => p > 0);

const engagedRows = rows.filter((r: any) =>
  r.decision === "love" || r.decision === "maybe"
);

const engagedPrices = engagedRows
  .map((r: any) => toNumber(r.price_text || r.price))
  .filter((p: number) => p > 0);

const highestSeenPrice =
  engagedPrices.length > 0
    ? Math.max(...engagedPrices)
    : Math.max(...prices);
const currentMax = highestSeenPrice;

    let query = supabase
      .from("listing_rows")
      .select("*")
      .gt("price", currentMax)
      .order("price", { ascending: true })
      .limit(100);

if (city) query = query.eq("normalized_city", city);
if (area) query = query.ilike("normalized_area", `%${area}%`);
if (type) query = query.eq("normalized_type", type);
if (beds) query = query.gte("beds", beds);

   const { data: candidates, error } = await query;

if (error) throw error;

console.log("EXPAND SEARCH QUERY DEBUG", {
  city,
  area,
  type,
  beds,
  currentMax,
  candidateCount: candidates?.length || 0,
  candidates: (candidates || []).map((r: any) => ({
    id: r.id,
    price: r.price,
    address: r.address,
    city: r.normalized_city,
    area: r.normalized_area,
    type: r.normalized_type,
    beds: r.beds
  }))
});

 const next = (candidates || [])
  .filter((r: any) => {
    const id = String(r.id || "").trim();
    return id && !sentIds.has(id);
  })
  .slice(0, 3);

    if (!next.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `No next matches found above $${currentMax.toLocaleString()}.`
        }),
        { status: 200 }
      );
    }

    console.log(
      "EXPAND SEARCH IMAGE DEBUG",
      next.map((r: any) => ({
        id: r.id,
        address: r.address,
        image_url: r.image_url,
        photo_url: r.photo_url,
        thumbnail_url: r.thumbnail_url,
        photo_urls: r.photo_urls,
        images: r.images
      }))
    );

    const inserts = next.map((r: any, i: number) => {
      const gallery = normalizeImageArray(r.images || r.photo_urls);
      const imageUrl = getBestImage(r) || gallery[0] || "";

      return {
        shortlist_send_id: shortlist.id,

        // listing_id is UUID in your DB. Repliers ids are text, so keep this null.
        listing_id: null,

        repliers_listing_id: String(r.id),
        sort_order: 1000 + i,

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
        source: "expand_search"
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from("shortlist_items")
      .insert(inserts)
      .select("*");

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        ok: true,
        added: inserted?.length || 0,
        listings: inserted || []
      }),
      { status: 200 }
    );
  } catch (err: any) {
    console.error("EXPAND SEARCH ERROR:", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message || "Expand search failed"
      }),
      { status: 500 }
    );
  }
};