import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanHost(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";

  return host
    .split(",")[0]
    .trim()
    .replace(/^www\./, "")
    .split(":")[0];
}

async function getSiteId(request: Request, id?: string | null) {
  const cleanId = String(id || "").trim();

  if (cleanId && cleanId !== "undefined" && cleanId !== "null") {
    return cleanId;
  }

  const domain = cleanHost(request);

  const { data } = await supabase
    .from("sites")
    .select("id")
    .eq("domain", domain)
    .maybeSingle();

  return data?.id || null;
}

export const GET: APIRoute = async ({ request, url }) => {
  const siteId = await getSiteId(request, url.searchParams.get("id"));

  if (!siteId) {
    return new Response(
      JSON.stringify({ ok: false, error: "Site not found for this domain." }),
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true, data }));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, data } = body;

  const siteId = await getSiteId(request, id);

  if (!siteId) {
    return new Response(
      JSON.stringify({ ok: false, error: "Site not found for this domain." }),
      { status: 404 }
    );
  }

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
    .eq("id", siteId);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true }));
};