import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async ({ url }) => {
  try {
    const name = String(url.searchParams.get("name") || "").trim();

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (!name) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing buyer name" }),
        { status: 400 }
      );
    }

    const { data: buyers, error: buyersError } = await supabase
      .from("buyers")
      .select("id, name")
      .ilike("name", name);

    if (buyersError) throw buyersError;

    const buyerIds = (buyers || []).map((b) => b.id);

    let sendsQuery = supabase
      .from("shortlist_sends")
      .select("id, buyer_id, client_name, shortlist_slug, created_at, last_viewed_at");

    if (buyerIds.length) {
      sendsQuery = sendsQuery.or(
        `buyer_id.in.(${buyerIds.join(",")}),client_name.ilike.${name}`
      );
    } else {
      sendsQuery = sendsQuery.ilike("client_name", name);
    }

    const { data: sends, error: sendsError } = await sendsQuery;

    if (sendsError) throw sendsError;

    const sendIds = (sends || []).map((s) => s.id);

    const { data: items, error: itemsError } = sendIds.length
      ? await supabase
          .from("shortlist_items")
          .select("*")
          .in("shortlist_send_id", sendIds)
      : { data: [], error: null };

    if (itemsError) throw itemsError;

    return new Response(
      JSON.stringify({
        ok: true,
        sends: sends || [],
        items: items || []
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Could not load buyer detail"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};