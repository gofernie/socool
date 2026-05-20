import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const prerender = false;

const accountSid = import.meta.env.TWILIO_ACCOUNT_SID;
const authToken = import.meta.env.TWILIO_AUTH_TOKEN;
const fromNumber = import.meta.env.TWILIO_FROM_NUMBER;
const agentPhone = import.meta.env.AGENT_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { slug, message, comment } = await request.json();

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "Missing slug" }), {
        status: 400
      });
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: send, error: sendError } = await supabase
      .from("shortlist_sends")
      .select("client_name, buyer_name")
      .eq("shortlist_slug", slug)
      .maybeSingle();

    if (sendError) throw sendError;

    const buyerName =
      send?.client_name ||
      send?.buyer_name ||
      "Buyer";

    if (comment) {
      const { error } = await supabase
        .from("shortlist_sends")
        .update({ buyer_review_note: comment })
        .eq("shortlist_slug", slug);

      if (error) throw error;
    }

    if (!agentPhone) {
      return new Response(JSON.stringify({ ok: false, error: "Missing AGENT_PHONE_NUMBER" }), {
        status: 500
      });
    }

    const body =
      `${buyerName} reviewed their shortlist.\n\n` +
      `${message || `${buyerName} reviewed all homes.`}` +
      `${comment ? `\n\n${buyerName} note:\n${comment}` : ""}` +
      `\n\nOpen: ${import.meta.env.PUBLIC_SITE_URL}/shortlists/${slug}?agent=1`;

    await client.messages.create({
      from: fromNumber,
      to: agentPhone,
      body
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to send review notification"
      }),
      { status: 500 }
    );
  }
};