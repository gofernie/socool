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
    const id = String(body?.id || "").trim();

    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: "Missing vendor id." }), {
        status: 400
      });
    }

    const { error } = await supabase
      .from("buyer_resource_vendors")
      .update({ is_active: false })
      .eq("id", id);

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
        error: err instanceof Error ? err.message : "Failed to delete vendor."
      }),
      { status: 500 }
    );
  }
};