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

function getListingId(listing: any) {
  return String(
    listing.id ||
      listing.mlsNumber ||
      listing.ml_num ||
      listing.listingId ||
      ""
  ).trim();
}

function getBeds(listing: any) {
  return (
    listing.details?.numBedrooms ??
    listing.details?.beds ??
    listing.beds ??
    null
  );
}

function getBaths(listing: any) {
  return (
    listing.details?.numBathrooms ??
    listing.details?.baths ??
    listing.baths ??
    null
  );
}

export const GET: APIRoute = async () => {
  try {
    if (!REPLIERS_API_KEY) {
      throw new Error("Missing REPLIERS_API_KEY");
    }

    const city = "Nanaimo";
    const resultsPerPage = 100;
    let pageNum = 1;
    let totalSaved = 0;
    let keepGoing = true;

    while (keepGoing) {
      const query = new URLSearchParams({
        city,
        pageNum: String(pageNum),
        resultsPerPage: String(resultsPerPage),
        hasImages: "true",
        include: "details,address,images"
      });

      console.log("REFRESH REPLIERS:", query.toString());

      const res = await fetch(`${REPLIERS_BASE_URL}/listings?${query}`, {
        headers: {
          "REPLIERS-API-KEY": REPLIERS_API_KEY,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Repliers error ${res.status}: ${text}`);
      }

      const json = await res.json();
      const listings = json?.listings || [];

      if (!listings.length) {
        keepGoing = false;
        break;
      }

      const rows = listings
        .map((listing: any) => {
          const id = getListingId(listing);
          if (!id) return null;

          return {
            id,
            city: listing.address?.city || city,
            area: listing.address?.area || null,
            class: listing.class || null,
            type:
              listing.details?.propertySubType ||
              listing.propertySubType ||
              listing.details?.propertyType ||
              listing.propertyType ||
              listing.type ||
              null,
            price: listing.listPrice || null,
            beds: getBeds(listing),
            baths: getBaths(listing),
            raw: listing,
            updated_at: new Date().toISOString()
          };
        })
        .filter(Boolean);

      if (rows.length) {
        const { error } = await supabase
          .from("repliers_listing_cache")
          .upsert(rows, { onConflict: "id" });

        if (error) {
          throw new Error(error.message);
        }

        totalSaved += rows.length;
      }

      if (listings.length < resultsPerPage) {
        keepGoing = false;
      } else {
        pageNum += 1;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        city,
        totalSaved,
        pagesChecked: pageNum
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error: any) {
    console.error(error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || "Refresh failed"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};