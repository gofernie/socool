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

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, phone")
      .ilike("name", name);

    if (clientsError) throw clientsError;

    const clientIds = (clients || []).map((client: any) => String(client.id));

    let sendsQuery = supabase
      .from("shortlist_sends")
      .select(
        "id, buyer_id, client_id, client_name, shortlist_slug, created_at, last_viewed_at"
      );

    if (clientIds.length) {
      sendsQuery = sendsQuery.or(
        `client_id.in.(${clientIds.join(",")}),client_name.ilike.${name}`
      );
    } else {
      sendsQuery = sendsQuery.ilike("client_name", name);
    }

    const { data: rawSends, error: sendsError } = await sendsQuery;

    if (sendsError) throw sendsError;

    const sends = Array.from(
      new Map((rawSends || []).map((send: any) => [String(send.id), send])).values()
    );

    const sendIds = sends.map((send: any) => send.id);

    const { data: items, error: itemsError } = sendIds.length
      ? await supabase
          .from("shortlist_items")
          .select("*")
          .in("shortlist_send_id", sendIds)
      : { data: [], error: null };

    if (itemsError) throw itemsError;

    const { data: metricsRows, error: metricsError } = sendIds.length
      ? await supabase
          .from("shortlist_listing_metrics")
          .select("*")
          .in("shortlist_send_id", sendIds)
          .order("updated_at", { ascending: false })
      : { data: [], error: null };

    if (metricsError) throw metricsError;

    const metricsByKey = new Map<string, any>();

    function mergeMetric(existing: any, metric: any) {
      if (!existing) {
        return {
          ...metric,
          time_spent_seconds: Number(metric.time_spent_seconds || 0),
          unique_images_viewed: Math.max(
            Number(metric.unique_images_viewed || 0),
            Number(metric.max_image_index || 0) + 1
          ),
          image_views: Number(metric.image_views || 0),
          max_image_index: Number(metric.max_image_index || 0),
          secondary_reasons: Array.isArray(metric.secondary_reasons)
            ? metric.secondary_reasons
            : []
        };
      }

      const existingReasons = Array.isArray(existing.secondary_reasons)
        ? existing.secondary_reasons
        : [];

      const newReasons = Array.isArray(metric.secondary_reasons)
        ? metric.secondary_reasons
        : [];

      return {
        ...existing,
        time_spent_seconds: Math.max(
          Number(existing.time_spent_seconds || 0),
          Number(metric.time_spent_seconds || 0)
        ),

        unique_images_viewed: Math.max(
          Number(existing.unique_images_viewed || 0),
          Number(metric.unique_images_viewed || 0),
          Number(metric.max_image_index || 0) + 1
        ),

        image_views:
          Number(existing.image_views || 0) + Number(metric.image_views || 0),

        max_image_index: Math.max(
          Number(existing.max_image_index || 0),
          Number(metric.max_image_index || 0)
        ),

        primary_reaction:
          metric.primary_reaction || existing.primary_reaction || null,

        secondary_reasons: Array.from(
          new Set([...existingReasons, ...newReasons])
        ),

        updated_at:
          new Date(metric.updated_at || 0).getTime() >
          new Date(existing.updated_at || 0).getTime()
            ? metric.updated_at
            : existing.updated_at
      };
    }

    for (const metric of metricsRows || []) {
      const keys = [
        metric.listing_id
          ? `${metric.shortlist_send_id}:${metric.listing_id}`
          : "",
        metric.mls ? `${metric.shortlist_send_id}:${metric.mls}` : ""
      ].filter(Boolean);

      for (const key of keys) {
        metricsByKey.set(key, mergeMetric(metricsByKey.get(key), metric));
      }
    }

    const itemsWithMetrics = (items || []).map((item: any) => {
      const possibleListingIds = [
        item.repliers_listing_id,
        item.listing_id,
        item.mls_number,
        item.mls,
        item.id
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      const metrics =
        possibleListingIds
          .map((id) => metricsByKey.get(`${item.shortlist_send_id}:${id}`))
          .find(Boolean) || null;

      return {
        ...item,
        metrics
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        clients: clients || [],
        sends,
        items: itemsWithMetrics
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error: any) {
    console.error("BUYER DETAIL ERROR", error);

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