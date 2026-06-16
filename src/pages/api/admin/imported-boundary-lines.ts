import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url }) => {
  const city = url.searchParams.get("city");
  const site_id = url.searchParams.get("site_id");

  if (!city) {
    return new Response(JSON.stringify({ ok: false, error: "Missing city" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let query = supabase
    .from("imported_boundary_lines")
    .select("*")
    .eq("city", String(city).toLowerCase());

  if (site_id) {
    query = query.eq("site_id", site_id);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      lines: data || [],
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
};