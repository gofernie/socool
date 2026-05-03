import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name } = await request.json();

    if (!name) {
      return json({ ok: false, error: "Missing buyer name" }, 400);
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const clean = (value: any) => String(value || "").trim().toLowerCase();

    const parsePrice = (value: any) => {
      const num = Number(String(value || "").replace(/[^\d]/g, ""));
      return Number.isFinite(num) && num > 0 ? num : 0;
    };

    const addressKey = (value: any) =>
      clean(value)
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const avg = (values: number[]) =>
      values.length
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : 0;

    const mostCommon = (values: any[]) => {
      const counts = new Map<string, number>();

      values.map(clean).filter(Boolean).forEach((value) => {
        counts.set(value, (counts.get(value) || 0) + 1);
      });

      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    };

    const normalizeImageUrl = (value: any) => {
      const url = String(value || "").trim();
      if (!url) return null;
      if (url.startsWith("http://") || url.startsWith("https://")) return url;
      return `https://cdn.repliers.io/${url.replace(/^\/+/, "")}`;
    };

    const { data: sends, error: sendsError } = await supabase
      .from("shortlist_sends")
      .select("id, client_name")
      .ilike("client_name", `%${name}%`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (sendsError) throw sendsError;

    const sendIds = (sends || []).map((send: any) => send.id);

    if (!sendIds.length) {
      return json({
        ok: true,
        listings: [],
        matches: [],
        debug: { reason: "No shortlist sends found", name }
      });
    }

    const { data: items, error: itemsError } = await supabase
      .from("shortlist_items")
      .select(
        "id, shortlist_send_id, address, price_text, beds, decision, is_favourite"
      )
      .in("shortlist_send_id", sendIds)
      .limit(100);

    if (itemsError) throw itemsError;

    const sentItems = items || [];

    const likedItems = sentItems.filter((item: any) => {
      return item.is_favourite === true || item.decision === "maybe";
    });

    const sourceItems = likedItems.length ? likedItems : sentItems;

    const sentAddresses = Array.from(
      new Set(sentItems.map((item: any) => item.address).filter(Boolean))
    );

    const sourceAddressKeys = new Set(
      sourceItems.map((item: any) => addressKey(item.address)).filter(Boolean)
    );

    const alreadySentKeys = new Set(
      sentItems
        .flatMap((item: any) => [item.id, item.address])
        .map(addressKey)
        .filter(Boolean)
    );

    let knownRows: any[] = [];

    if (sentAddresses.length) {
      const { data: matchedRows, error: matchedRowsError } = await supabase
        .from("listing_rows")
        .select(
          "id, address, city, normalized_city, normalized_type, price, beds, baths, sqft, image_url, description"
        )
        .in("address", sentAddresses)
        .limit(100);

      if (matchedRowsError) throw matchedRowsError;

      knownRows = matchedRows || [];
    }

    const sourceRows = knownRows.filter((row: any) =>
      sourceAddressKeys.has(addressKey(row.address))
    );

    const criteriaRows = sourceRows.length ? sourceRows : knownRows;

    const likedCity = mostCommon(criteriaRows.map((row: any) => row.normalized_city));
    const likedType = mostCommon(criteriaRows.map((row: any) => row.normalized_type));

    const likedBeds =
      Math.max(
        1,
        ...criteriaRows.map((row: any) => Number(row.beds || 0)).filter(Boolean)
      ) || 1;

    const sentPrices = knownRows
  .map((row: any) => parsePrice(row.price))
  .filter(Boolean);

const likedPrices = sourceRows
  .map((row: any) => parsePrice(row.price))
  .filter(Boolean);

const likedPrice = avg(likedPrices.length ? likedPrices : sentPrices);

const originalMinPrice = sentPrices.length ? Math.min(...sentPrices) : 0;
const originalMaxPrice = sentPrices.length ? Math.max(...sentPrices) : 0;
const likedMaxPrice = likedPrices.length ? Math.max(...likedPrices) : likedPrice;

const likedNearCeiling =
  originalMaxPrice &&
  likedMaxPrice &&
  likedMaxPrice >= originalMaxPrice * 0.9;

const lowPrice = likedNearCeiling
  ? Math.round(originalMaxPrice)
  : likedPrice
    ? Math.round(likedPrice * 0.975)
    : 0;

const highPrice = likedNearCeiling
  ? Math.round(originalMaxPrice * 1.15)
  : likedPrice
    ? Math.round(likedPrice * 1.035)
    : 99999999;

const matchMode = likedNearCeiling ? "stretch_above_original_ceiling" : "around_liked_price";

    async function queryCandidates(options: {
      useCity: boolean;
      useType: boolean;
      useBeds: boolean;
      usePrice: boolean;
    }) {
      let query = supabase
        .from("listing_rows")
        .select(
          "id, address, city, normalized_city, normalized_type, price, beds, baths, sqft, image_url, description"
        )
        .limit(60);

      if (options.useCity && likedCity) {
        query = query.eq("normalized_city", likedCity);
      }

      if (options.useType && likedType) {
        query = query.eq("normalized_type", likedType);
      }

      if (options.useBeds && likedBeds) {
        query = query.gte("beds", likedBeds);
      }

      if (options.usePrice && likedPrice) {
        query = query.gte("price", lowPrice).lte("price", highPrice);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    }

const attempts = [
  { useCity: true, useType: true, useBeds: true, usePrice: true },
  { useCity: true, useType: true, useBeds: false, usePrice: true },
  { useCity: true, useType: false, useBeds: false, usePrice: true },
  { useCity: true, useType: true, useBeds: true, usePrice: false }
];

    let rows: any[] = [];
    let usedAttempt: any = null;

    for (const attempt of attempts) {
      const candidates = await queryCandidates(attempt);

      const filtered = candidates.filter((row: any) => {
        return ![row.id, row.address].some((value) =>
          alreadySentKeys.has(addressKey(value))
        );
      });

      if (filtered.length >= 3) {
        rows = filtered;
        usedAttempt = attempt;
        break;
      }

      if (filtered.length > rows.length) {
        rows = filtered;
        usedAttempt = attempt;
      }
    }

    const scoreRow = (row: any) => {
      let score = 0;

      if (likedCity && clean(row.normalized_city) === likedCity) score += 100;
      if (likedType && clean(row.normalized_type) === likedType) score += 80;

      const beds = Number(row.beds || 0);
      if (beds >= likedBeds) score += 40;

      const price = parsePrice(row.price);
      if (likedPrice && price) {
        score -= Math.abs(price - likedPrice) / 1000;
      }

      return score;
    };

    const matches = rows
      .sort((a: any, b: any) => scoreRow(b) - scoreRow(a))
      .slice(0, 3)
      .map((row: any) => {
        const image = normalizeImageUrl(row.image_url);

        return {
          id: row.id,
          mls: row.id,
          address: row.address || "Listing",
          price: row.price,
          priceText: row.price
            ? `$${Number(row.price).toLocaleString()}`
            : "Price unavailable",
          beds: row.beds || null,
          baths: row.baths || null,
          sqft: row.sqft || null,
          type: row.normalized_type || null,
          city: row.city || row.normalized_city || null,
          image,
          images: image ? [image] : [],
          description: row.description || ""
        };
      });

    return json({
      ok: true,
      listings: matches,
      matches,
      debug: {
        name,
        sentItems: sentItems.length,
        likedItems: likedItems.length,
        knownRows: knownRows.length,
        sourceRows: sourceRows.length,
        likedCity,
        likedType,
        likedBeds,
        likedPrice,
originalMinPrice,
originalMaxPrice,
likedMaxPrice,
likedNearCeiling,
lowPrice,
highPrice,
matchMode,
        pool: rows.length,
        matched: matches.length,
        usedAttempt
      }
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || "Could not load better matches"
      },
      500
    );
  }
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}