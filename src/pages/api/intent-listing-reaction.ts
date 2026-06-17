import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const sessionId = String(body.session_id || "").trim();
    const decision = String(body.decision || "").trim();

    if (!sessionId || !decision) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing session_id or decision" }),
        { status: 400 }
      );
    }

    await supabase.from("intent_sessions").upsert(
      {
        session_id: sessionId,
        intent_page_id: body.intent_page_id || null,
        slug: body.slug || null,
        city: body.city || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    const { error } = await supabase.from("intent_listing_reactions").upsert(
      {
        session_id: sessionId,
        intent_page_id: body.intent_page_id || null,
        slug: body.slug || null,
        city: body.city || null,

        listing_id: body.listing_id || null,
        mls_number: body.mls_number || null,
        address: body.address || null,
        price: body.price || null,
        beds: body.beds || null,
        baths: body.baths || null,
        sqft: body.sqft || null,
       area: body.area || null,
        normalized_type: body.normalized_type || null,

        decision,
        liked_tags: body.liked_tags || [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id,listing_id" }
    );

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Unknown error" }),
      { status: 500 }
    );
  }
};