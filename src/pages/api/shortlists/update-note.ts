import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase env vars for update-note route.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const slug = String(body?.slug || "").trim();
    const note = String(body?.note || "").trim();

    if (!slug) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing shortlist slug." }),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("shortlist_sends")
      .update({ note })
      .eq("shortlist_slug", slug);

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ ok: true, note }), { status: 200 });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Failed to save message."
      }),
      { status: 500 }
    );
  }
};