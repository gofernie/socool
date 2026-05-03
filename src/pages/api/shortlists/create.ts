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

function normalizeClientName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isUuid(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
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
    console.log("SHORTLIST CREATE BODY:", body);

    const listingIds = Array.isArray(body?.listingIds) ? body.listingIds : [];
    const listingSnapshots = Array.isArray(body?.listingSnapshots)
      ? body.listingSnapshots
      : [];

    const clientName =
      typeof body?.clientName === "string" ? body.clientName.trim() : "";

        const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    const searchCity = typeof body?.city === "string" ? body.city.trim() : "";
    const searchArea = typeof body?.area === "string" ? body.area.trim() : "";
    const searchType = typeof body?.type === "string" ? body.type.trim() : "";

    const searchMinPrice =
      Number.isFinite(Number(body?.minPrice)) && body?.minPrice !== ""
        ? Number(body.minPrice)
        : null;

    const searchMaxPrice =
      Number.isFinite(Number(body?.maxPrice)) && body?.maxPrice !== ""
        ? Number(body.maxPrice)
        : null;

    const searchBeds =
      Number.isFinite(Number(body?.beds)) && body?.beds !== ""
        ? Number(body.beds)
        : null;

    const searchBaths =
      Number.isFinite(Number(body?.baths)) && body?.baths !== ""
        ? Number(body.baths)
        : null;

    if (!listingIds.length && !listingSnapshots.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "No listings selected" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    let clientId: string | null = null;
    let buyerId: string | null = null;

    if (clientName) {
      const normalizedName = normalizeClientName(clientName);

      const { data: existingClient, error: clientLookupError } =
        await supabaseAdmin
          .from("clients")
          .select("id, name, phone")
          .eq("normalized_name", normalizedName)
          .maybeSingle();

      console.log("CLIENT LOOKUP:", existingClient, clientLookupError);

      if (clientLookupError) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Client lookup failed: ${clientLookupError.message}`
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (existingClient?.id) {
        clientId = existingClient.id;

        if (phone && phone !== existingClient.phone) {
          const { error: clientUpdateError } = await supabaseAdmin
            .from("clients")
            .update({ phone })
            .eq("id", existingClient.id);

          console.log("CLIENT PHONE UPDATE:", existingClient.id, clientUpdateError);

          if (clientUpdateError) {
            return new Response(
              JSON.stringify({
                ok: false,
                error: `Client phone update failed: ${clientUpdateError.message}`
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            );
          }
        }
      } else {
        const { data: newClient, error: clientCreateError } =
          await supabaseAdmin
            .from("clients")
            .insert({
              name: clientName,
              normalized_name: normalizedName,
              phone: phone || null
            })
            .select("id")
            .single();

        console.log("CLIENT CREATE:", newClient, clientCreateError);

        if (clientCreateError) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: `Client create failed: ${clientCreateError.message}`
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        clientId = newClient.id;
      }

      const { data: existingBuyerRows, error: buyerLookupError } =
        await supabaseAdmin
          .from("buyers")
          .select("id, name, phone")
          .eq("name", clientName)
          .limit(1);

      console.log("BUYER LOOKUP:", existingBuyerRows, buyerLookupError);

      if (buyerLookupError) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Buyer lookup failed: ${buyerLookupError.message}`
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      const existingBuyer = existingBuyerRows?.[0];

      if (existingBuyer?.id) {
        buyerId = existingBuyer.id;

        if (phone && phone !== existingBuyer.phone) {
          const { error: buyerUpdateError } = await supabaseAdmin
            .from("buyers")
            .update({ phone })
            .eq("id", existingBuyer.id);

          console.log("BUYER PHONE UPDATE:", existingBuyer.id, buyerUpdateError);

          if (buyerUpdateError) {
            return new Response(
              JSON.stringify({
                ok: false,
                error: `Buyer phone update failed: ${buyerUpdateError.message}`
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            );
          }
        }
      } else {
        const { data: newBuyer, error: buyerCreateError } = await supabaseAdmin
          .from("buyers")
          .insert({
            name: clientName,
            phone: phone || null
          })
          .select("id")
          .single();

        console.log("BUYER CREATE:", newBuyer, buyerCreateError);

        if (buyerCreateError) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: `Buyer create failed: ${buyerCreateError.message}`
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        buyerId = newBuyer.id;
      }
    }

    const shortlistSlug = generateSlug();
    const shortlistUrl = `/shortlists/${shortlistSlug}`;

    const { data: shortlist, error: shortlistError } = await supabaseAdmin
      .from("shortlist_sends")
      .insert({
        shortlist_slug: shortlistSlug,
        shortlist_url: shortlistUrl,
        client_name: clientName || null,
        client_id: clientId,
        buyer_id: buyerId,
                client_phone: phone || null,
        note: note || null,
        status: "draft",

        search_city: searchCity || null,
        search_area: searchArea || null,
        search_type: searchType || null,
        search_min_price: searchMinPrice,
        search_max_price: searchMaxPrice,
        search_beds: searchBeds,
        search_baths: searchBaths
      })
      .select("id, shortlist_slug, shortlist_url")
      .single();

    console.log("SHORTLIST INSERT:", shortlist, shortlistError);

    if (shortlistError || !shortlist?.id) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: shortlistError?.message || "Could not create shortlist"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const snapshotRows = listingSnapshots.map((listing: any, index: number) => {
      const internalListingId = isUuid(listing?.id)
        ? listing.id
        : isUuid(listingIds[index])
          ? listingIds[index]
          : null;

      return {
        shortlist_send_id: shortlist.id,
        listing_id: internalListingId,
        repliers_listing_id:
          listing?.repliers_listing_id || listing?.id || listingIds[index] || null,
        sort_order: index + 1,
        address: listing?.address || null,
        price_text: listing?.price_text || null,
        image_url: listing?.image_url || null,
        images: listing?.images || [],
        beds: listing?.beds || null,
        baths: listing?.baths || null,
        property_type: listing?.property_type || null,
        sqft: listing?.sqft || null,
        year_built: listing?.year_built || null,
        description: listing?.description || null
      };
    });

    console.log("SHORTLIST ITEM ROWS:", snapshotRows);

    const { error: itemsError } = await supabaseAdmin
      .from("shortlist_items")
      .insert(snapshotRows);

    console.log("SHORTLIST ITEMS INSERT ERROR:", itemsError);

    if (itemsError) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Shortlist items insert failed: ${itemsError.message}`
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
        shortlistId: shortlist.id,
        slug: shortlist.shortlist_slug,
        shortlistUrl,
        clientId,
        buyerId
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    console.error("SHORTLIST CREATE UNEXPECTED ERROR:", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || "Unexpected error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};