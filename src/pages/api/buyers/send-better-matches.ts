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

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let finalMessage = message;
    let shortlistUrl: string | null = null;

    if (Array.isArray(listings) && listings.length) {
      const slug = `${String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;

      const siteUrl = import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321";
      shortlistUrl = `${siteUrl}/shortlists/${slug}`;

      const { data: send, error: sendError } = await supabase
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
        .select("id")
        .single();

      if (sendError) throw sendError;

      const items = listings.map((listing: any, index: number) => ({
        shortlist_send_id: send.id,
        repliers_listing_id: listing.id || listing.mls || null,
        sort_order: index + 1,
        address: listing.address || "Listing",
        price_text:
          listing.priceText ||
          (listing.price ? `$${Number(listing.price).toLocaleString()}` : null),

   image_url: (() => {
  const rawImage =
    listing.image ||
    listing.images?.[0] ||
    listing.photo_urls?.[0] ||
    null;

  if (!rawImage) return null;

  const url = String(rawImage).trim();

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://cdn.repliers.io/${url.replace(/^\/+/, "")}`;
})(),

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
        liked_tags: []
      }));

      const { error: itemsError } = await supabase.from("shortlist_items").insert(items);
      if (itemsError) throw itemsError;

      finalMessage = `${message}

View them here:
${shortlistUrl}`;
    }

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
        last_contact_note: note || "Sent 3 better matches"
      })
      .ilike("client_name", name);

    return new Response(JSON.stringify({ ok: true, sent_at: now, shortlistUrl }), {
      status: 200
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Could not send matches" }),
      { status: 500 }
    );
  }
};