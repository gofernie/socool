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
    const slug = String(body?.slug || "").trim();
    const type = String(body?.type || "other").trim();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    const email = String(body?.email || "").trim();
    const website = String(body?.website || body?.website_url || "").trim();
    const note = String(body?.note || body?.description || "").trim();

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug." }), { status: 400 });
    }

    if (!name && !note) {
      return new Response(JSON.stringify({ ok: false, error: "Add a name or note." }), { status: 400 });
    }

    if (id) {
      const { data: vendor, error } = await supabase
        .from("buyer_resource_vendors")
        .update({
          type,
          name,
          phone,
          email,
          website,
          note,
          is_active: true
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error || !vendor?.id) {
        return new Response(
          JSON.stringify({ ok: false, error: error?.message || "Could not update vendor." }),
          { status: 500 }
        );
      }

      return new Response(JSON.stringify({ ok: true, vendor }), { status: 200 });
    }

    const { data: vendor, error: vendorError } = await supabase
      .from("buyer_resource_vendors")
      .insert({
        type,
        name,
        phone,
        email,
        website,
        note,
        is_active: true
      })
      .select("*")
      .single();

    if (vendorError || !vendor?.id) {
      return new Response(
        JSON.stringify({ ok: false, error: vendorError?.message || "Could not create vendor." }),
        { status: 500 }
      );
    }

    const { data: existing } = await supabase
      .from("shortlist_resource_vendors")
      .select("sort_order")
      .eq("shortlist_slug", slug)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = Number(existing?.[0]?.sort_order || 0) + 1;

    await supabase
      .from("shortlist_resource_vendors")
      .insert({
        shortlist_slug: slug,
        vendor_id: vendor.id,
        is_selected: true,
        sort_order: nextSortOrder
      });

    return new Response(JSON.stringify({ ok: true, vendor }), { status: 200 });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to save resource."
      }),
      { status: 500 }
    );
  }
};