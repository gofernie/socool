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
    const { slug, message, comment, reason } = await request.json();

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
      .select("client_name, client_id")
      .eq("shortlist_slug", slug)
      .maybeSingle();

    if (sendError) throw sendError;

    const buyerName = send?.client_name || "Buyer";

    if (comment) {
      const { error } = await supabase
        .from("shortlist_sends")
        .update({ buyer_review_note: comment })
        .eq("shortlist_slug", slug);

      if (error) throw error;
    }

    // Skip SMS for intermediate pings — only notify on meaningful events
    const silentReasons = ["completed"];
    if (silentReasons.includes(reason)) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (!agentPhone) {
      return new Response(JSON.stringify({ ok: false, error: "Missing AGENT_PHONE_NUMBER" }), {
        status: 500
      });
    }

    const reasonLabel =
      reason === "consult"
        ? `🎯 ${buyerName} has completed a full review cycle and is ready for a follow-up.`
        : reason === "comment"
          ? `💬 ${buyerName} left a note on their shortlist.`
          : reason === "skipped"
            ? `⚠️ ${buyerName} left the review early.`
            : `✅ ${buyerName} reviewed their shortlist.`;

          const buyerAnchor = buyerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

     const requestUrl = new URL(request.url);

    const crmBaseUrl =
      `${requestUrl.protocol}//${requestUrl.host}`;

    const crmUrl =
      `${crmBaseUrl}/admin/buyers#buyer-${buyerAnchor}`;
    const body =
      `${reasonLabel}\n\n` +
      `${message || ""}` +
      `${comment ? `\n\n${buyerName}'s note:\n"${comment}"` : ""}` +
      `\n\nOpen CRM: ${crmUrl}`;

    await client.messages.create({
      from: fromNumber,
      to: agentPhone,
      body
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("REVIEW COMPLETE ERROR:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Failed to send review notification"
      }),
      { status: 500 }
    );
  }
};