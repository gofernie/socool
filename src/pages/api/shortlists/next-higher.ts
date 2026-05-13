import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL!,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY!
);

const toNumber = (value: any) =>
  Number(String(value || "").replace(/[^0-9]/g, "")) || 0;

export const GET: APIRoute = async ({ url }) => {
  try {
    const slug = String(url.searchParams.get("slug") || "").trim();
    const excludeParam = url.searchParams.get("exclude") || "[]";

    if (!slug) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing shortlist slug" }),
        { status: 400 }
      );
    }

    // IDs already visible on screen — sent by the client
    let clientExcludeIds: string[] = [];
    try {
      clientExcludeIds = JSON.parse(excludeParam).map(String).filter(Boolean);
    } catch {
      clientExcludeIds = [];
    }

    const { data: shortlist, error: shortlistError } = await supabase
      .from("shortlist_sends")
      .select("*")
      .eq("shortlist_slug", slug)
      .single();

    if (shortlistError) throw shortlistError;

    const { data: existingItems, error: existingError } = await supabase
      .from("shortlist_items")
      .select("repliers_listing_id, listing_id, price_text")
      .eq("shortlist_send_id", shortlist.id);

    if (existingError) throw existingError;

    // Combine DB shortlist IDs + whatever is currently on screen
    const existingIds = new Set(
      [
        ...(existingItems || []).flatMap((item: any) => [
          item.repliers_listing_id,
          item.listing_id,
        ]),
        ...clientExcludeIds,
      ]
        .filter(Boolean)
        .map(String)
    );

    const existingPrices = (existingItems || [])
      .map((item: any) => toNumber(item.price_text))
      .filter(Boolean);

    const highestExistingPrice = existingPrices.length
      ? Math.max(...existingPrices)
      : 0;

    let query = supabase
      .from("listing_rows")
      .select("*")
      .eq("normalized_city", shortlist.search_city || "nanaimo")
      .gt("price", highestExistingPrice)
      .order("price", { ascending: true })
      .limit(20); // fetch extra so we have room to filter out excluded IDs

    if (shortlist.search_type) {
      query = query.eq("normalized_type", shortlist.search_type);
    }

    if (shortlist.search_area) {
      query = query.eq("normalized_area", shortlist.search_area);
    }

    const { data: rows, error: rowsError } = await query;

    if (rowsError) throw rowsError;

    const items = (rows || [])
      .filter((row: any) => {
        const rowIds = [
          String(row.id || ""),
          String(row.repliers_listing_id || ""),
          String(row.listing_id || ""),
          String(row.mls_number || ""),
        ].filter(Boolean);

        return !rowIds.some((id) => existingIds.has(id));
      })
      .slice(0, 3)
      .map((row: any) => ({
        id: row.id,
        repliers_listing_id: row.repliers_listing_id || row.mls_number || row.id,
        listing_id: row.listing_id || row.id,
        mls_number: row.mls_number || "",
        price: row.price,
        price_text: row.price ? `$${Number(row.price).toLocaleString()}` : "Price unavailable",
        address: row.address || "Address unavailable",
        beds: row.beds || "-",
        baths: row.baths || "-",
        sqft: row.sqft || "",
        property_type: row.normalized_type || row.property_type || "Home",
        year_built: row.year_built || "",
        days_on_market: row.days_on_market || "",
        image_url: row.image_url || "",
        images: row.images || [],
        description: row.description || "A quick preview of this property.",
        normalized_city: row.normalized_city || "",
        normalized_area: row.normalized_area || "",
        lat: row.lat || "",
        lng: row.lng || "",
      }));

    return new Response(
      JSON.stringify({
        ok: true,
        highestExistingPrice,
        count: items.length,
        items,
      }),
      { status: 200 }
    );
  } catch (err: any) {
    console.error("NEXT HIGHER API ERROR", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || "Could not load next higher listings",
      }),
      { status: 500 }
    );
  }
};