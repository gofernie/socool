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

    const slug = String(body?.slug || "").trim();
    const type = String(body?.type || "other").trim();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    const email = String(body?.email || "").trim();
    const website_url = String(body?.website_url || "").trim();
    const description = String(body?.description || "").trim();

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug." }), {
        status: 400
      });
    }

    if (!name && !description) {
      return new Response(JSON.stringify({ ok: false, error: "Add a name or note." }), {
        status: 400
      });
    }

    const { data: shortlist, error: shortlistError } = await supabase
      .from("shortlist_sends")
      .select("id")
      .eq("shortlist_slug", slug)
      .single();

    if (shortlistError || !shortlist?.id) {
      return new Response(JSON.stringify({ ok: false, error: "Shortlist not found." }), {
        status: 404
      });
    }

    const { data: existing } = await supabase
      .from("shortlist_resources")
      .select("sort_order")
      .eq("shortlist_send_id", shortlist.id)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = Number(existing?.[0]?.sort_order || 0) + 1;

    const { data, error } = await supabase
      .from("shortlist_resources")
      .insert({
        shortlist_send_id: shortlist.id,
        type,
        name,
        phone,
        email,
        website_url,
        description,
        is_visible: true,
        sort_order: nextSortOrder
      })
      .select("*")
      .single();

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500
      });
    }

    return new Response(JSON.stringify({ ok: true, resource: data }), {
      status: 200
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to add resource."
      }),
      { status: 500 }
    );
  }
};