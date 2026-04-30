import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  const slug = String(body?.slug || "").trim();
  const smsMessage = String(body?.smsMessage || "").trim();

  if (!slug) {
    return new Response(JSON.stringify({ ok: false, error: "Missing slug." }), { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("shortlist_sends")
    .update({ sms_message: smsMessage || null })
    .eq("shortlist_slug", slug);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, smsMessage }), { status: 200 });
};