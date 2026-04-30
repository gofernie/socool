import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async () => {
  const { data, error } = await supabase
    .from("buyer_resource_vendors")
    .select("*")
    .eq("is_active", true)
    .order("type")
    .order("name");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ vendors: data || [] }), { status: 200 });
};