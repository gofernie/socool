import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get("id");

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, data }));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, data } = body;

  const { error } = await supabase
    .from("sites")
    .update({
      site_name: data.siteName || data.site_name,
      accent_color: data.accentColor,
      city: data.city,
      hero_eyebrow: data.heroEyebrow,
      hero_heading: data.heroHeading,
      hero_copy: data.heroIntro,
      intro_copy: data.cityIntro,
      bio: data.agentBio,
    })
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }));
};