import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();

    if (!email && !phone) {
      return new Response(JSON.stringify({ ok: false, error: "Email or phone required" }), {
        status: 400,
      });
    }

    const lead = {
  session_id: body.session_id || "",
  intent_page_id: body.intent_page_id || null,
  city: body.city || "",
  slug: body.slug || "",
  name,
  email,
  phone,
  source: body.source || "intent_refined_search",
};

    const { data, error } = await supabase
      .from("intent_leads")
      .insert(lead)
      .select()
      .single();

    if (error) throw error;

    const sid = import.meta.env.TWILIO_ACCOUNT_SID;
    const token = import.meta.env.TWILIO_AUTH_TOKEN;
    const from = import.meta.env.TWILIO_FROM_NUMBER;
    const notifyPhone = import.meta.env.AGENT_PHONE_NUMBER;

    if (sid && token && from && notifyPhone) {
      const client = twilio(sid, token);

       await client.messages.create({
        from,
        to: notifyPhone,
        body:
          `New intent lead\n\n` +
          `Source: ${body.source || "intent_refined_search"}\n` +
          `Name: ${name || "Not provided"}\n` +
          `Email: ${email || "Not provided"}\n` +
          `Phone: ${phone || "Not provided"}\n` +
          `City: ${lead.city || "Not provided"}\n` +
          `Page: ${lead.slug || "Not provided"}\n` +
          `Address: ${body.address || "Not provided"}\n` +
          `Price: ${body.price || "Not provided"}\n` +
          `MLS: ${body.mls_number || "Not provided"}\n\n` +
          `${String(import.meta.env.PUBLIC_SITE_URL || "https://chriscrump.com").replace(/\/$/, "")}/admin/intent-sessions?session=${encodeURIComponent(lead.session_id)}`,
      });
    }

    return new Response(JSON.stringify({ ok: true, lead: data }), {    
      status: 200,
    });
  } catch (error) {
    console.error("intent-lead error", error);

    return new Response(JSON.stringify({ ok: false, error: "Could not save lead" }), {
      status: 500,
    });
  }
};