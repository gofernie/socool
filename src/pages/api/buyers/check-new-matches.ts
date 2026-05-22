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

    const loved = (items || []).filter(
      (i) =>
        i.is_favourite === true ||
        String(i.decision || "").toLowerCase().includes("love")
    );

    const maybe = (items || []).filter((i) =>
      String(i.decision || "").toLowerCase().includes("maybe")
    );

    const source = loved.length ? loved : maybe;

    if (!source.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No preference signals yet"
        }),
        { status: 400 }
      );
    }

    const prices = source
      .map((i) => parsePrice(i.price_text))
      .filter(Boolean);

    const avgPrice = Math.round(
      prices.reduce((a, b) => a + b, 0) / prices.length
    );

    const sample = source[0];

    const city =
      sample.city ||
      sample.normalized_city ||
      "";

    const type =
      sample.property_type ||
      sample.type ||
      "";

    const minPrice = avgPrice - 75000;
    const maxPrice = avgPrice + 75000;

    const { data: listings } = await supabase
      .from("listing_rows")
      .select("*")
      .eq("normalized_city", String(city).toLowerCase())
      .gte("price", minPrice)
      .lte("price", maxPrice)
      .limit(20);

    const alreadySentIds = new Set(
      (items || []).map((i) => String(i.repliers_listing_id || i.listing_id))
    );

    const freshListings = (listings || []).filter(
      (l) => !alreadySentIds.has(String(l.id))
    );

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
      await supabase
        .from("buyer_match_notifications")
        .insert({
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
      `Hey ${name}, I found ${topMatches.length} new homes that line up with what you liked.\n\n` +
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