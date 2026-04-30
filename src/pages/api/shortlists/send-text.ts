import type { APIRoute } from "astro";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const accountSid = import.meta.env.TWILIO_ACCOUNT_SID;
const authToken = import.meta.env.TWILIO_AUTH_TOKEN;
const fromNumber = import.meta.env.TWILIO_FROM_NUMBER;
const siteUrl = import.meta.env.PUBLIC_SITE_URL;

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase env vars for send-text route.");
}

const client = twilio(accountSid, authToken);
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function normalizePhone(input: string) {
  const raw = String(input || "").trim();

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return raw;

  return null;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const shortlistSlug = String(body?.slug || "").trim();
    const slug = shortlistSlug;
    const clientName = String(body?.clientName || "").trim();
    const phone = normalizePhone(body?.phone || "");
    const agentName = String(body?.agentName || "").trim();
    const smsImageUrl = String(body?.smsImageUrl || "").trim();
    const note = String(body?.note || "").trim();

    if (!shortlistSlug) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing shortlist slug." }),
        { status: 400 }
      );
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid phone number." }),
        { status: 400 }
      );
    }

    if (!siteUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing PUBLIC_SITE_URL." }),
        { status: 500 }
      );
    }

    if (!fromNumber) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing TWILIO_FROM_NUMBER." }),
        { status: 500 }
      );
    }

    const cleanBase = String(siteUrl).replace(/\/$/, "");

   const shortlistPath = `/shortlists/${shortlistSlug}`;

const { data: existingRow, error: existingRowError } = await supabase
  .from("shortlist_sends")
  .select("id")
  .eq("shortlist_slug", shortlistSlug)
  .single();

if (existingRowError && existingRowError.code !== "PGRST116") {
  return new Response(
    JSON.stringify({
      ok: false,
      error: existingRowError.message || "Failed to check existing send row."
    }),
    { status: 500 }
  );
}

let sendRow = existingRow;

if (!sendRow) {
  const { data: insertedRow, error: sendInsertError } = await supabase
    .from("shortlist_sends")
    .insert({
  shortlist_slug: shortlistSlug,
  shortlist_url: shortlistPath,
  client_name: clientName || null,
  status: "pending",
  message_body: null,
  sms_image_url: smsImageUrl || null,
  sms_image_source: smsImageUrl ? "custom" : "auto"
})
    .select()
    .single();

  if (sendInsertError || !insertedRow) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: sendInsertError?.message || "Failed to create send row."
      }),
      { status: 500 }
    );
  }

  sendRow = insertedRow;
} else {
  const { error: prepUpdateError } = await supabase
    .from("shortlist_sends")
    .update({
  shortlist_url: shortlistPath,
  client_name: clientName || null,
  status: "pending",
  sms_image_url: smsImageUrl || null,
  sms_image_source: smsImageUrl ? "custom" : "auto"
})
    .eq("id", sendRow.id);

  if (prepUpdateError) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: prepUpdateError.message || "Failed to prepare existing send row."
      }),
      { status: 500 }
    );
  }
}

    const { data: shortlist } = await supabase
  .from("shortlist_sends")
  .select("sms_message, note, sms_image_url")
  .eq("shortlist_slug", shortlistSlug)
  .single();

const shortlistUrl = `${cleanBase}/shortlists/${shortlistSlug}`;
const introName = clientName ? `Hi ${clientName}, ` : "Hi, ";
const senderLine = agentName ? ` - ${agentName}` : "";

const savedSmsMessage = String(shortlist?.sms_message || "").trim();
const savedHeroMessage = String(shortlist?.note || "").trim();

const introCopy =
  savedSmsMessage ||
  savedHeroMessage ||
  note ||
  "I pulled these homes together based on what you're looking for.";

const messageBody =
  `${introName}${introCopy}` +
  `${senderLine}\n${shortlistUrl}`;

const finalImage = smsImageUrl || shortlist?.sms_image_url || null;

// send
const sentMessage = await client.messages.create({
  body: messageBody,
  from: fromNumber,
  to: phone,
  
});

    const { error: sendUpdateError } = await supabase
      .from("shortlist_sends")
      .update({
        status: "sent",
        message_body: messageBody,
        sent_at: new Date().toISOString()
      })
      .eq("id", sendRow.id);

    if (sendUpdateError) {
      console.error("Failed to update shortlist_sends after send:", sendUpdateError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sid: sentMessage.sid
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Failed to send text."
      }),
      { status: 500 }
    );
  }
};