import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { slug, showResources } = await request.json();

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), {
        status: 400
      });
    }

    const { error } = await supabase
      .from("shortlist_sends")
      .update({ show_resources: Boolean(showResources) })
      .eq("shortlist_slug", slug);

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error"
      }),
      { status: 500 }
    );
  }
};