import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateSlug() {
  return Math.random().toString(36).slice(2, 10);
}

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      ok: true,
      route: "/api/shortlists/create"
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    console.log("SHORTLIST ROUTE HIT");
    console.log("BODY:", body);

    const { listings, note } = body;

    if (!listings || !Array.isArray(listings) || listings.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "No listings provided" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const shortlistSlug = generateSlug();
    const shortlistUrl = `/shortlists/${shortlistSlug}`;

    const { data: shortlist, error: shortlistError } = await supabaseAdmin
      .from("shortlist_sends")
      .insert({
        shortlist_slug: shortlistSlug,
        shortlist_url: shortlistUrl,
        message_body: note || null
      })
      .select()
      .single();

    console.log("SHORTLIST INSERT RESULT:", shortlist);
    console.log("SHORTLIST INSERT ERROR:", shortlistError);

    if (shortlistError || !shortlist) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: shortlistError?.message || "Failed to create shortlist"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const rows = listings.map((listing: any, index: number) => ({
      shortlist_send_id: shortlist.id,
      repliers_listing_id: listing.repliers_listing_id || null,
      sort_order: index,
      address: listing.address || null,
      price_text: listing.price_text || null,
      image_url: listing.image_url || null,
      beds: listing.beds || null,
      baths: listing.baths || null,
      property_type: listing.property_type || null,
      sqft: listing.sqft || null,
      year_built: listing.year_built || null,
      description: listing.description || null
    }));

    console.log("ITEM ROWS:", rows);

    const { error: itemsError } = await supabaseAdmin
      .from("shortlist_items")
      .insert(rows);

    console.log("ITEM INSERT ERROR:", itemsError);

    if (itemsError) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: itemsError.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        shortlistUrl
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    console.error("SHORTLIST ROUTE CRASH:", err);

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