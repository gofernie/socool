import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const client = twilio(
  import.meta.env.TWILIO_ACCOUNT_SID,
  import.meta.env.TWILIO_AUTH_TOKEN
);

function parsePrice(value: any) {
  const raw = String(value || "").replace(/[^\d]/g, "");
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function normalizeText(value: any) {
  return String(value || "").trim().toLowerCase();
}

function topValue(values: string[]) {
  const counts: Record<string, number> = {};

  for (const value of values) {
    if (!value || value === "unknown") continue;
    counts[value] = (counts[value] || 0) + 1;
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name } = await request.json();

    if (!name) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing buyer name" }),
        { status: 400 }
      );
    }

    const { data: sends } = await supabase
      .from("shortlist_sends")
      .select("*")
      .eq("client_name", name)
      .order("created_at", { ascending: false });

    if (!sends?.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "No shortlist history found" }),
        { status: 404 }
      );
    }

    const latestSend = sends[0];

    const { data: items } = await supabase
      .from("shortlist_items")
      .select("*")
      .eq("shortlist_send_id", latestSend.id);

    const originalItems = (items || []).filter((i) => {
      const itemSource = normalizeText(i.source);
      return itemSource !== "expand_search" && itemSource !== "refine_search";
    });

    if (!originalItems.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No original shortlist homes found"
        }),
        { status: 400 }
      );
    }

    const prices = originalItems
      .map((i) => parsePrice(i.price_text || i.price))
      .filter(Boolean);

    if (!prices.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No usable prices found on original shortlist homes"
        }),
        { status: 400 }
      );
    }

    const minSentPrice = Math.min(...prices);
    const maxSentPrice = Math.max(...prices);

    const minPrice = Math.max(0, Math.floor(minSentPrice * 0.9));
    const maxPrice = Math.ceil(maxSentPrice * 1.15);

   const city =
  topValue(
    originalItems.map((i) =>
      normalizeText(i.normalized_city || i.city)
    )
  ) ||
  normalizeText(latestSend.search_city);

    const area = topValue(
      originalItems.map((i) => normalizeText(i.normalized_area || i.area))
    );

    const type = topValue(
      originalItems.map((i) =>
        normalizeText(i.property_type || i.normalized_type || i.type)
      )
    );

    if (!city) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No usable city found on original shortlist homes"
        }),
        { status: 400 }
      );
    }

    let query = supabase
      .from("listing_rows")
      .select("*")
      .eq("status", "A")
      .eq("normalized_city", city)
      .gte("price", minPrice)
      .lte("price", maxPrice)
      .order("listed_at", { ascending: false })
      .limit(30);

    if (area) {
      query = query.eq("normalized_area", area);
    }

    if (type && type !== "land" && type !== "mobile") {
      query = query.eq("normalized_type", type);
    }

    const { data: listings, error: listingsError } = await query;

    if (listingsError) throw listingsError;

    const alreadySentIds = new Set(
      (items || [])
        .flatMap((i) => [
          String(i.repliers_listing_id || "").trim(),
          String(i.listing_id || "").trim(),
          String(i.mls_number || "").trim()
        ])
        .filter(Boolean)
    );

    const freshListings = (listings || []).filter((l) => {
      const rowId = String(l.id || "").trim();
      const repliersId = String(l.repliers_listing_id || "").trim();
      const mlsId = String(l.mls_number || "").trim();

      return (
        rowId &&
        !alreadySentIds.has(rowId) &&
        !alreadySentIds.has(repliersId) &&
        !alreadySentIds.has(mlsId)
      );
    });

    if (!freshListings.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No new matches found"
        }),
        { status: 200 }
      );
    }

    const topMatches = freshListings.slice(0, 5);

    for (const listing of topMatches) {
      await supabase.from("buyer_match_notifications").insert({
        buyer_name: name,
        buyer_phone: latestSend.client_phone,
        shortlist_slug: latestSend.shortlist_slug,
        listing_row_id: listing.id
      });
    }

    const lines = topMatches.map(
      (l, i) =>
        `${i + 1}. ${l.address} - $${Number(l.price).toLocaleString()}`
    );

    const body =
      `Hey ${name}, I found ${topMatches.length} new homes that line up with what I sent you.\n\n` +
      `${lines.join("\n")}\n\n` +
      `Want me to send over more details or book a showing?`;

    if (latestSend.client_phone) {
      await client.messages.create({
        from: import.meta.env.TWILIO_FROM_NUMBER,
        to: latestSend.client_phone,
        body
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: topMatches.length
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    console.error(err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message || "Failed"
      }),
      { status: 500 }
    );
  }
};