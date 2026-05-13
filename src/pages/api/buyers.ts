import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async () => {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, phone")
      .order("name", { ascending: true });

    if (clientsError) throw clientsError;

    const { data: sends, error: sendsError } = await supabase
      .from("shortlist_sends")
      .select(
        "id, buyer_id, client_id, client_name, client_phone, last_viewed_at, last_contacted_at, last_contact_note"
      );

    if (sendsError) throw sendsError;

    const sendIds = (sends || []).map((send: any) => send.id);

    const { data: items, error: itemsError } = sendIds.length
      ? await supabase
          .from("shortlist_items")
          .select(
            "shortlist_send_id, decision, is_favourite, price_text, liked_tags"
          )
          .in("shortlist_send_id", sendIds)
      : { data: [], error: null };

    if (itemsError) throw itemsError;

    const sendsByClientId = new Map<string, any[]>();
    const sendsByClientName = new Map<string, any[]>();
    const itemsBySendId = new Map<string, any[]>();
    const map = new Map<string, any>();

    function cleanName(value: any) {
      return String(value || "").trim();
    }

    function nameKey(value: any) {
      return cleanName(value).toLowerCase();
    }

    function newerDate(a: string | null, b: string | null) {
      if (!a) return b;
      if (!b) return a;
      return new Date(b).getTime() > new Date(a).getTime() ? b : a;
    }

    function parsePrice(value: any) {
      const raw = String(value || "").replace(/[^\d]/g, "");
      const num = Number(raw);
      return Number.isFinite(num) && num > 0 ? num : null;
    }

    function avg(values: number[]) {
      if (!values.length) return null;
      return Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length
      );
    }

    function formatPrice(value: number | null) {
      if (!value) return "";
      return `$${Math.round(value / 1000)}k`;
    }

    function buildPriceSignal(stats: any) {
      const lovedAvg = avg(stats.lovedPrices);
      const maybeAvg = avg(stats.maybePrices);
      const passAvg = avg(stats.passPrices);

      stats.lovedAvgPrice = lovedAvg;
      stats.maybeAvgPrice = maybeAvg;
      stats.passAvgPrice = passAvg;

      if (lovedAvg && passAvg && passAvg - lovedAvg >= 50000) {
        const suggestedMax = Math.ceil((lovedAvg + 50000) / 25000) * 25000;

        stats.suggestedMaxPrice = suggestedMax;
        stats.priceSignal = `Price signal: likes homes closer to ${formatPrice(
          lovedAvg
        )}, passing more often around ${formatPrice(
          passAvg
        )}. Next batch should probably stay under ${formatPrice(
          suggestedMax
        )}.`;

        return;
      }

      if (lovedAvg && maybeAvg && maybeAvg - lovedAvg >= 50000) {
        stats.priceSignal = `Price signal: strongest reactions are around ${formatPrice(
          lovedAvg
        )}. Maybes are trending higher at ${formatPrice(maybeAvg)}.`;

        return;
      }

      if (lovedAvg) {
        stats.priceSignal = `Price signal: loved homes average around ${formatPrice(
          lovedAvg
        )}. Use that as the next-match anchor.`;

        return;
      }

      if (passAvg) {
        stats.priceSignal = `Price signal: passed homes average around ${formatPrice(
          passAvg
        )}. Current pricing may be missing the mark.`;

        return;
      }

      stats.priceSignal = "";
    }

    function makeEntry({
      id,
      name,
      phone
    }: {
      id: string | null;
      name: string;
      phone?: string;
    }) {
      return {
        id,
        name: name || "Unnamed buyer",
        phone: phone || "",
        email: "",
        stats: {
          shortlists: 0,
          loved: 0,
          maybe: 0,
          notForMe: 0,
          lastViewed: null,
          lastActivityAt: null,
          lastContactedAt: null,
          lastContactNote: "",
          lovedPrices: [],
          maybePrices: [],
          passPrices: [],
          lovedAvgPrice: null,
          maybeAvgPrice: null,
          passAvgPrice: null,
          priceSignal: "",
          suggestedMaxPrice: null
        }
      };
    }

    for (const send of sends || []) {
      const clientId = send.client_id ? String(send.client_id) : "";
      const clientNameKey = nameKey(send.client_name);

      if (clientId) {
        const list = sendsByClientId.get(clientId) || [];
        list.push(send);
        sendsByClientId.set(clientId, list);
      }

      if (clientNameKey) {
        const list = sendsByClientName.get(clientNameKey) || [];
        list.push(send);
        sendsByClientName.set(clientNameKey, list);
      }
    }

    for (const item of items || []) {
      const sendId = String(item.shortlist_send_id || "");
      if (!sendId) continue;

      const list = itemsBySendId.get(sendId) || [];
      list.push(item);
      itemsBySendId.set(sendId, list);
    }

    function applySendToEntry(entry: any, send: any) {
      entry.stats.lastViewed = newerDate(
        entry.stats.lastViewed,
        send.last_viewed_at || null
      );

      entry.stats.lastActivityAt = newerDate(
        entry.stats.lastActivityAt,
        send.last_viewed_at || null
      );

      entry.stats.lastContactedAt = newerDate(
        entry.stats.lastContactedAt,
        send.last_contacted_at || null
      );

      if (send.last_contact_note) {
        entry.stats.lastContactNote = send.last_contact_note;
      }

      if (!entry.phone && send.client_phone) {
        entry.phone = send.client_phone;
      }

      const sendItems = itemsBySendId.get(String(send.id || "")) || [];

      for (const item of sendItems) {
        const decision = String(item.decision || "").toLowerCase();
        const favouriteValue = String(item.is_favourite || "").toLowerCase();
        const likedTags = Array.isArray(item.liked_tags) ? item.liked_tags : [];
        const price = parsePrice(item.price_text);

        const isLoved =
          item.is_favourite === true ||
          favouriteValue === "true" ||
          favouriteValue === "1" ||
          favouriteValue === "yes" ||
          decision.includes("love") ||
          decision.includes("loved") ||
          decision.includes("favourite") ||
          decision.includes("favorite");

        const isPass =
          decision.includes("pass") ||
          decision.includes("not_for_me") ||
          decision.includes("not for me") ||
          decision.includes("not-for-me");

        const isMaybe =
          !isLoved &&
          !isPass &&
          (decision.includes("maybe") ||
            decision.includes("not_sure") ||
            decision.includes("not sure") ||
            decision.includes("consider") ||
            likedTags.length > 0);

        if (isLoved) {
          entry.stats.loved++;
          if (price) entry.stats.lovedPrices.push(price);
          continue;
        }

        if (isMaybe) {
          entry.stats.maybe++;
          if (price) entry.stats.maybePrices.push(price);
          continue;
        }

        if (isPass) {
          entry.stats.notForMe++;
          if (price) entry.stats.passPrices.push(price);
        }
      }
    }

    for (const client of clients || []) {
      const id = String(client.id || "");
      const key = nameKey(client.name);

      const entry = makeEntry({
        id,
        name: cleanName(client.name) || "Unnamed buyer",
        phone: client.phone || ""
      });

      const clientSendsMap = new Map<string, any>();

      for (const send of sendsByClientId.get(id) || []) {
        clientSendsMap.set(String(send.id), send);
      }

      for (const send of sendsByClientName.get(key) || []) {
        clientSendsMap.set(String(send.id), send);
      }

      const clientSends = Array.from(clientSendsMap.values());

      entry.stats.shortlists = clientSends.length;

      for (const send of clientSends) {
        applySendToEntry(entry, send);
      }

      buildPriceSignal(entry.stats);
      map.set(id || key, entry);
    }

    for (const send of sends || []) {
      const id = send.client_id ? String(send.client_id) : "";
      const key = nameKey(send.client_name);
      const mapKey = id || key;

      if (!mapKey || map.has(mapKey)) continue;

      const entry = makeEntry({
        id: id || null,
        name: cleanName(send.client_name) || "Unnamed buyer",
        phone: send.client_phone || ""
      });

      const sendList = id
        ? [...(sendsByClientId.get(id) || []), ...(sendsByClientName.get(key) || [])]
        : sendsByClientName.get(key) || [];

      const uniqueSends = Array.from(
        new Map(sendList.map((s: any) => [String(s.id), s])).values()
      );

      entry.stats.shortlists = uniqueSends.length;

      for (const buyerSend of uniqueSends) {
        applySendToEntry(entry, buyerSend);
      }

      buildPriceSignal(entry.stats);
      map.set(mapKey, entry);
    }

    const results = Array.from(map.values()).sort((a, b) => {
      const timeA = a.stats.lastActivityAt
        ? new Date(a.stats.lastActivityAt).getTime()
        : 0;

      const timeB = b.stats.lastActivityAt
        ? new Date(b.stats.lastActivityAt).getTime()
        : 0;

      return timeB - timeA;
    });

    return new Response(JSON.stringify({ ok: true, buyers: results }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("BUYERS API ERROR", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Could not load buyers"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};