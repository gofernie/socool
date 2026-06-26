import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url }) => {
  const city = url.searchParams.get("city");
  const area_slug = url.searchParams.get("area_slug");
  const site_id = url.searchParams.get("site_id");

  if (!city || !area_slug) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing city or area_slug" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  let query = supabase
    .from("area_boundaries")
    .select("*")
    .eq("city", String(city).toLowerCase())
    .eq("area_slug", String(area_slug).toLowerCase());

  if (site_id) {
    query = query.eq("site_id", site_id);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

// Fall back to area_metadata for copy fields if no boundary row yet
  const { data: meta } = await supabase
    .from("area_metadata")
    .select("*")
    .eq("city", String(city).toLowerCase())
    .eq("area_slug", String(area_slug).toLowerCase())
    .maybeSingle();

  const merged = {
    ...(meta || {}),
    ...(data || {}),
    // area_metadata column names -> boundary field names
    hero_heading: data?.hero_heading || meta?.h1 || "",
    seo_heading: data?.seo_heading || meta?.h2 || "",
    seo_title: data?.seo_title || meta?.seo_title || "",
    intro_copy: data?.intro_copy || meta?.intro_copy || "",
    meta_description: data?.meta_description || meta?.meta_description || "",
    short_description: data?.short_description || meta?.short_description || "",
  };

  return new Response(
    JSON.stringify({
      ok: true,
      boundary: merged,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

const {
    site_id,
    city,
    area_slug,
    area_name,
    short_description,
    hero_image_url,
    hero_heading,
    seo_heading,
    seo_title,
    intro_copy,
    meta_description,
    polygon_geojson,
    center_lat,
    center_lng,
  } = body;

  if (!site_id || !city || !area_slug || !polygon_geojson) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing required fields" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { error } = await supabase.from("area_boundaries").upsert(
    {
      site_id,
      city: String(city).toLowerCase(),
      area_slug: String(area_slug).toLowerCase(),
      area_name,
    short_description: short_description || null,
      hero_image_url: hero_image_url || null,
      hero_heading: hero_heading || null,
      seo_heading: seo_heading || null,
      seo_title: seo_title || null,
      intro_copy: intro_copy || null,
      meta_description: meta_description || null,
      polygon_geojson,
      center_lat,
      center_lng,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "city,area_slug",
    }
  );

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};