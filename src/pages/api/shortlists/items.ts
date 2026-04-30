import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing shortlist slug" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { data: shortlist, error: shortlistError } = await supabase
      .from("shortlist_sends")
      .select("id")
      .eq("shortlist_slug", slug)
      .single();

    if (shortlistError || !shortlist?.id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Shortlist not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from("shortlist_items")
      .select("id, listing_id, repliers_listing_id")
      .eq("shortlist_send_id", shortlist.id);

    if (itemsError) {
      return new Response(
        JSON.stringify({ ok: false, error: itemsError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const normalized = (items || []).map((item) => ({
      shortlistItemId: item?.id ? String(item.id) : "",
      listingId: item?.listing_id ? String(item.listing_id) : "",
      repliersListingId: item?.repliers_listing_id ? String(item.repliers_listing_id) : ""
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        items: normalized
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Server error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};