import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name, phone, message, note, listings } = await request.json();

    if (!name || !phone || !message) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing name, phone, or message" }),
        { status: 400 }
      );
    }

    if (!Array.isArray(listings) || !listings.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "No listings to send" }),
        { status: 400 }
      );
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const siteUrl =
  import.meta.env.PUBLIC_SITE_URL ||
  "https://crump1.netlify.app";

const cleanBase = String(siteUrl).replace(/\/$/, "");

    // 1. Find the buyer's latest existing shortlist
    let { data: existingSend, error: existingError } = await supabase
      .from("shortlist_sends")
      .select("id, shortlist_slug, shortlist_url")
      .ilike("client_name", name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    // 2. If no existing shortlist exists, create one as a fallback
    if (!existingSend) {
      const slug = `${String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;

const shortlistUrl = `${cleanBase}/shortlists/${slug}`;
      const { data: newSend, error: newSendError } = await supabase
        .from("shortlist_sends")
        .insert({
          client_name: name,
          client_phone: phone,
          shortlist_slug: slug,
          shortlist_url: shortlistUrl,
          message_body: message,
          status: "sent",
          sent_at: new Date().toISOString()
        })
        .select("id, shortlist_slug, shortlist_url")
        .single();

      if (newSendError) throw newSendError;

      existingSend = newSend;
    }

    const shortlistUrl = `${cleanBase}/shortlists/${existingSend.shortlist_slug}`;

    // 3. Find the current highest sort_order so new matches appear after existing ones
    const { data: existingItems, error: sortError } = await supabase
      .from("shortlist_items")
      .select("sort_order")
      .eq("shortlist_send_id", existingSend.id)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (sortError) throw sortError;

    const startSort = existingItems?.[0]?.sort_order || 0;

    // 4. Add the better matches as NEW unreviewed items
    const items = listings.map((listing: any, index: number) => {
      const rawImage =
        listing.image ||
        listing.images?.[0] ||
        listing.photo_urls?.[0] ||
        null;

      let imageUrl = null;

      if (rawImage) {
        const url = String(rawImage).trim();

        imageUrl =
          url.startsWith("http://") || url.startsWith("https://")
            ? url
            : `https://cdn.repliers.io/${url.replace(/^\/+/, "")}`;
      }

      return {
        shortlist_send_id: existingSend.id,
        repliers_listing_id: listing.id || listing.mls || null,
        sort_order: startSort + index + 1,

        address: listing.address || listing.full_address || "Listing",
        price_text:
          listing.priceText ||
          listing.price_text ||
          (listing.price ? `$${Number(listing.price).toLocaleString()}` : null),

        image_url: imageUrl,

        beds: listing.beds || null,
        baths: listing.baths || null,
        property_type: listing.type || listing.property_type || null,

        description:
          listing.description ||
          listing.publicRemarks ||
          listing.remarks ||
          listing.details?.description ||
          "I found this as a closer match based on what you’ve been reacting to.",

        is_favourite: false,
        decision: null,
        liked_tags: []
      };
    });

    const { error: itemsError } = await supabase
      .from("shortlist_items")
      .insert(items);

    if (itemsError) throw itemsError;

    const finalMessage = `${message}

I added them to your shortlist here:
${shortlistUrl}`;

    const client = twilio(
      import.meta.env.TWILIO_ACCOUNT_SID,
      import.meta.env.TWILIO_AUTH_TOKEN
    );

    const digits = String(phone).replace(/\D/g, "");
    const to = digits.length === 10 ? `+1${digits}` : phone;

    await client.messages.create({
      from: import.meta.env.TWILIO_FROM_NUMBER,
      to,
      body: finalMessage
    });

    const now = new Date().toISOString();

    await supabase
      .from("shortlist_sends")
      .update({
        last_contacted_at: now,
        last_contact_note: note || "Added and sent 3 better matches"
      })
      .eq("id", existingSend.id);

    return new Response(
      JSON.stringify({
        ok: true,
        sent_at: now,
        shortlistUrl,
        addedToExistingShortlist: true
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Could not send matches"
      }),
      { status: 500 }
    );
  }
};