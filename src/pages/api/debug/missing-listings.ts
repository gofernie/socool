import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import {
  getListingAddress,
  getListingBaths,
  getListingBeds,
  getListingId,
  getListingPrice,
  getListingType
} from "../../../lib/repliers";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url }) => {
  const city = String(url.searchParams.get("city") || "").toLowerCase();

  const { data, error } = await supabase
    .from("repliers_listing_cache")
    .select("*");

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500
    });
  }

  const rows = data || [];

  const checked = rows.map((row) => {
    const listing = row.raw;

    const listingCity = String(
      listing?.address?.city ||
      listing?.city ||
      ""
    ).toLowerCase();

    const visible = city ? listingCity === city : true;

    return {
      id: getListingId(listing),
      address: getListingAddress(listing),
      price: getListingPrice(listing),
      beds: getListingBeds(listing),
      baths: getListingBaths(listing),
      type: getListingType(listing),
      listingCity,
      area: listing?.address?.area || listing?.area || "",
      community: listing?.address?.community || listing?.community || "",
      visible,
      reason: visible ? "showing" : `city mismatch: ${listingCity || "blank"}`
    };
  });

  return new Response(
    JSON.stringify(
      {
        ok: true,
        selectedCity: city,
        totalInCache: checked.length,
        showing: checked.filter((x) => x.visible).length,
        missingFromPage: checked.filter((x) => !x.visible).length,
        missing: checked.filter((x) => !x.visible)
      },
      null,
      2
    ),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
};