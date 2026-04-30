import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { id } = await request.json();

    if (!id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing shortlist id" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { error } = await supabaseAdmin
      .from("shortlist_sends")
      .update({
        status: "sent",
        sent_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
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