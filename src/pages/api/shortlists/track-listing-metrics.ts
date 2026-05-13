import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL!,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const shortlistSendId = body.shortlistSendId;
    const listingId = body.listingId;
    const mls = body.mls || "";
    const timeSpentSeconds = Number(body.timeSpentSeconds || 0);
    const uniqueImagesViewed = Number(body.uniqueImagesViewed || 0);
    const imageViews = Number(body.imageViews || 0);
    const maxImageIndex = Number(body.maxImageIndex || 0);
    const primaryReaction = body.primaryReaction || null;
    const secondaryReasons = Array.isArray(body.secondaryReasons)
      ? body.secondaryReasons
      : [];

    if (!shortlistSendId || !listingId) {
      return new Response(JSON.stringify({ ok: false }), { status: 400 });
    }

    const { error } = await supabase
      .from("shortlist_listing_metrics")
      .insert({
        shortlist_send_id: shortlistSendId,
        listing_id: String(listingId),
        mls: String(mls),
        time_spent_seconds: timeSpentSeconds,
        unique_images_viewed: uniqueImagesViewed,
        image_views: imageViews,
        max_image_index: maxImageIndex,
        primary_reaction: primaryReaction,
        secondary_reasons: secondaryReasons,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("TRACK LISTING METRICS ERROR", error);
      return new Response(JSON.stringify({ ok: false }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("TRACK LISTING METRICS CRASH", err);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
};