import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url }) => {
  const city = String(url.searchParams.get("city") || "").trim().toLowerCase();

  let query = supabase
    .from("intent_pages")
    .select(`
      id,
      slug,
      city,
      area,
      property_type,
      lifestyle_angle,
      price_min,
      price_max,
      hero_heading,
      intro_copy,
      cta_style,
      status,
      is_indexed,
      created_at,
      updated_at
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (city) {
    query = query.eq("city", city);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
        pages: [],
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      pages: data || [],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};