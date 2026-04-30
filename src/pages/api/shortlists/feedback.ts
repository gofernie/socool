import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("FEEDBACK ROUTE HIT");

    const body = await request.json();

    const shortlistItemId = body.shortlistItemId;

    const liked_tags = Array.isArray(body.liked_tags)
      ? body.liked_tags
      : Array.isArray(body.likedTags)
        ? body.likedTags
        : [];

    const is_favourite =
      typeof body.is_favourite === "boolean"
        ? body.is_favourite
        : typeof body.isFavourite === "boolean"
          ? body.isFavourite
          : false;

    const decision =
      body.decision === "maybe" || body.decision === "pass"
        ? body.decision
        : null;

    console.log("PARSED FEEDBACK:", {
      shortlistItemId,
      liked_tags,
      is_favourite,
      decision
    });

    if (!shortlistItemId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing shortlistItemId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { data: existingItem, error: existingError } = await supabaseAdmin
      .from("shortlist_items")
      .select("id, liked_tags, is_favourite, decision")
      .eq("id", shortlistItemId)
      .single();

    console.log("EXISTING ITEM:", existingItem);
    console.log("EXISTING ITEM ERROR:", existingError);

    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from("shortlist_items")
      .update({
        liked_tags,
        is_favourite,
        decision
      })
      .eq("id", shortlistItemId)
      .select("id, liked_tags, is_favourite, decision")
      .single();

    console.log("UPDATED ITEM:", updatedItem);
    console.log("UPDATE ERROR:", updateError);

    if (updateError) {
      return new Response(
        JSON.stringify({ ok: false, error: updateError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        item: updatedItem
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("FEEDBACK ROUTE FATAL ERROR:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};