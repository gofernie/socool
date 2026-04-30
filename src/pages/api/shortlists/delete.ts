import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { shortlistId } = await request.json();

    if (!shortlistId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing shortlistId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { error: itemsError } = await supabaseAdmin
      .from("shortlist_items")
      .delete()
      .eq("shortlist_send_id", shortlistId);

    if (itemsError) {
      return new Response(
        JSON.stringify({ ok: false, error: itemsError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { error: shortlistError } = await supabaseAdmin
      .from("shortlist_sends")
      .delete()
      .eq("id", shortlistId);

    if (shortlistError) {
      return new Response(
        JSON.stringify({ ok: false, error: shortlistError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};