import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const REPLIERS_API_KEY = import.meta.env.REPLIERS_API_KEY;
const REPLIERS_BASE_URL =
  import.meta.env.REPLIERS_BASE_URL || "https://api.repliers.io";

function clean(value: any) {
  return String(value || "").trim();
}

function cleanKey(value: any) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function getListingId(listing: any) {
  return clean(
    listing?.id ||
      listing?.mlsNumber ||
      listing?.ml_num ||
      listing?.listingId ||
      listing?.mls_number
  );
}

async function fetchRepliers(params: URLSearchParams) {
  const apiUrl = `${REPLIERS_BASE_URL}/listings?${params.toString()}`;

  console.log("REPLIERS QUERY:", params.toString());

  const res = await fetch(apiUrl, {
    headers: {
      "REPLIERS-API-KEY": REPLIERS_API_KEY,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Repliers error ${res.status}: ${text}`);
  }

  return await res.json();
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const rawCity = clean(url.searchParams.get("city"));

    if (!rawCity) {
      return new Response(JSON.stringify({ ok: false, error: "Missing city" }), {
        status: 400
      });
    }

    const allListings: any[] = [];
    const seen = new Set<string>();

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams();

      params.set("city", rawCity);
      params.set("pageNum", String(page));
      params.set("resultsPerPage", "100");
      params.set("include", "details,address,images");

      const data = await fetchRepliers(params);
      const listings = data?.listings || data?.results || data || [];

      if (!Array.isArray(listings) || listings.length === 0) break;

      for (const listing of listings) {
        const id = getListingId(listing);

        if (!id || seen.has(id)) continue;

        seen.add(id);

        // Save raw Repliers listing only.
        allListings.push(listing);
      }

      hasMore = listings.length === 100;
      page++;
    }

    const searchKey = cleanKey(rawCity);

    const { error } = await supabase
      .from("listing_snapshots")
      .upsert(
        {
          search_key: searchKey,
          city: rawCity,
          listings: allListings
        },
        { onConflict: "search_key" }
      );

    if (error) throw error;

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "snapshot_only",
        city: rawCity,
        searchKey,
        totalFetched: allListings.length,
        message:
          "Fresh raw listings saved to listing_snapshots. Now run rebuild-listing-rows.ts to normalize."
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error(error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Unknown error"
      }),
      { status: 500 }
    );
  }
};