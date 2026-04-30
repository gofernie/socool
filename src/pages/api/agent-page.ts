import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug") || "chris-crump";

  const { data, error } = await supabase
    .from("agent_pages")
    .select("data")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      data: data?.data || null
    })
  );
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const slug = body.slug || "chris-crump";
  const data = body.data || {};

  const { error } = await supabase
    .from("agent_pages")
    .upsert(
      {
        slug,
        data,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "slug"
      }
    );

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500
    });
  }

  return new Response(JSON.stringify({ ok: true }));
};