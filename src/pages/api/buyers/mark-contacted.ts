import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name, note } = await request.json();

    if (!name) {
      return new Response(JSON.stringify({ ok: false, error: "Missing buyer name" }), {
        status: 400
      });
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("shortlist_sends")
      .update({
        last_contacted_at: now,
        last_contact_note: note || null
      })
      .ilike("client_name", name)
      .select("id, client_name, last_contacted_at, last_contact_note");

    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, last_contacted_at: now, note, updated: data?.length || 0 }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Could not mark contacted" }),
      { status: 500 }
    );
  }
};