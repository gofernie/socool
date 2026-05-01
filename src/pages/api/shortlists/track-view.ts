import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const slug = body.slug || body.shortlistSlug || body.shortlist_slug;

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing shortlist slug" }), {
        status: 400
      });
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("shortlist_sends")
      .update({
        last_viewed_at: now
      })
      .eq("shortlist_slug", slug);

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, viewed_at: now }), {
      status: 200
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Could not track shortlist view"
      }),
      { status: 500 }
    );
  }
};