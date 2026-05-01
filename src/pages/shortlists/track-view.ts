import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const slug = String(body.slug || "").trim();

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), {
        status: 400
      });
    }

    const { error } = await supabaseAdmin
      .from("shortlist_sends")
      .update({ last_viewed_at: new Date().toISOString() })
      .eq("shortlist_slug", slug);

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message || "Tracking failed" }),
      { status: 500 }
    );
  }
};