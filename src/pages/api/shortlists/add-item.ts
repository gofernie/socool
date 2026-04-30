import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const prerender = false;

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { slug, listing } = await request.json();

    if (!slug || !listing) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing data" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const incomingId = String(listing.id || "").trim();
    const incomingRepliersId = String(
      listing.repliers_listing_id || listing.id || ""
    ).trim();

    const listingUuid = looksLikeUuid(incomingId) ? incomingId : null;
    const repliersListingId = incomingRepliersId || null;

    const { data: shortlist, error: shortlistError } = await supabase
      .from("shortlist_sends")
      .select("id")
      .eq("shortlist_slug", slug)
      .single();

    if (shortlistError || !shortlist) {
      return new Response(
        JSON.stringify({ ok: false, error: "Shortlist not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    let existingQuery = supabase
      .from("shortlist_items")
      .select("id")
      .eq("shortlist_send_id", shortlist.id);

    if (listingUuid) {
      existingQuery = existingQuery.eq("listing_id", listingUuid);
    } else if (repliersListingId) {
      existingQuery = existingQuery.eq("repliers_listing_id", repliersListingId);
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing listing id" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          ok: true,
          duplicate: true,
          item: { id: existing.id }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const images = Array.isArray(listing.images) ? listing.images : [];

const firstImage =
  listing.image_url ||
  images?.[0]?.url ||
  images?.[0]?.highRes ||
  images?.[0]?.mediumRes ||
  images?.[0]?.lowRes ||
  images?.[0] ||
  null;

const insertPayload = {
  shortlist_send_id: shortlist.id,
  listing_id: listingUuid,
  repliers_listing_id: repliersListingId,
  address: listing.address || null,
  price_text: listing.price_text || null,
  image_url: firstImage,
  images,
  photo_urls: images,
  beds: listing.beds || null,
  baths: listing.baths || null,
  sqft: listing.sqft || null,
  property_type: listing.property_type || null,
  year_built: listing.year_built || null,
  description: listing.description || null
};

    const { data: inserted, error: insertError } = await supabase
      .from("shortlist_items")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ ok: false, error: insertError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        item: {
          id: inserted.id
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Server error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};