import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async () => {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: buyers, error: buyersError } = await supabase
      .from("buyers")
      .select("id, name, phone, email, updated_at")
      .order("updated_at", { ascending: false });

    if (buyersError) throw buyersError;

    const { data: sends, error: sendsError } = await supabase
      .from("shortlist_sends")
      .select(
        "id, buyer_id, client_name, client_phone, last_viewed_at, last_contacted_at, last_contact_note"
      );

    if (sendsError) throw sendsError;

    const sendIds = (sends || []).map((s) => s.id);

    const { data: items, error: itemsError } = sendIds.length
      ? await supabase
          .from("shortlist_items")
          .select("shortlist_send_id, decision, is_favourite, price_text")
          .in("shortlist_send_id", sendIds)
      : { data: [], error: null };

    if (itemsError) throw itemsError;

    const sendsByBuyer = new Map<string, any[]>();
    const itemsBySend = new Map<string, any[]>();
    const map = new Map<string, any>();

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
      return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
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
)}. Next batch should probably stay under ${formatPrice(suggestedMax)}.`;

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

    function addSendToBuyerMap(key: string, send: any) {
      if (!key) return;
      const list = sendsByBuyer.get(key) || [];
      list.push(send);
      sendsByBuyer.set(key, list);
    }

    for (const send of sends || []) {
      addSendToBuyerMap(send.buyer_id ? String(send.buyer_id) : "", send);
      addSendToBuyerMap(
        send.client_name ? String(send.client_name).trim().toLowerCase() : "",
        send
      );
    }

    for (const item of items || []) {
      const list = itemsBySend.get(item.shortlist_send_id) || [];
      list.push(item);
      itemsBySend.set(item.shortlist_send_id, list);
    }

    function makeEntry({
      id,
      name,
      phone,
      email
    }: {
      id: string | null;
      name: string;
      phone?: string;
      email?: string;
    }) {
      return {
        id,
        name: name || "Unnamed buyer",
        phone: phone || "",
        email: email || "",
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

      const sendItems = itemsBySend.get(send.id) || [];

      for (const item of sendItems) {
        const decision = String(item.decision || "").toLowerCase();
        const price = parsePrice(item.price_text);

        const isLoved =
          item.is_favourite === true ||
          decision === "love" ||
          decision === "loved";

        const isMaybe =
          decision === "maybe" ||
          decision === "not_sure" ||
          decision === "not sure";

        const isPass =
          decision === "pass" ||
          decision === "no" ||
          decision === "not_for_me";

        if (isLoved) {
          entry.stats.loved++;
          if (price) entry.stats.lovedPrices.push(price);
        }

        if (isMaybe) {
          entry.stats.maybe++;
          if (price) entry.stats.maybePrices.push(price);
        }

        if (isPass) {
          entry.stats.notForMe++;
          if (price) entry.stats.passPrices.push(price);
        }
      }
    }

    for (const buyer of buyers || []) {
      const name = buyer.name || "Unnamed buyer";
      const nameKey = String(name).trim().toLowerCase();
      const idKey = String(buyer.id || "");

      if (!map.has(nameKey)) {
        map.set(
          nameKey,
          makeEntry({
            id: buyer.id,
            name,
            phone: buyer.phone,
            email: buyer.email
          })
        );
      }

      const entry = map.get(nameKey);
      const buyerSendsMap = new Map<string, any>();

      for (const send of sendsByBuyer.get(idKey) || []) {
        buyerSendsMap.set(send.id, send);
      }

      for (const send of sendsByBuyer.get(nameKey) || []) {
        buyerSendsMap.set(send.id, send);
      }

      const buyerSends = Array.from(buyerSendsMap.values());

      entry.stats.shortlists = buyerSends.length;

      for (const send of buyerSends) {
        applySendToEntry(entry, send);
      }

      buildPriceSignal(entry.stats);
    }

    const existingBuyerNameKeys = new Set(
      (buyers || []).map((buyer) =>
        String(buyer.name || "Unnamed buyer").trim().toLowerCase()
      )
    );

    for (const send of sends || []) {
      const name = String(send.client_name || "").trim();
      const nameKey = name.toLowerCase();

      if (!name || existingBuyerNameKeys.has(nameKey)) continue;

      if (!map.has(nameKey)) {
        map.set(
          nameKey,
          makeEntry({
            id: send.buyer_id || null,
            name,
            phone: send.client_phone || "",
            email: ""
          })
        );
      }

      const entry = map.get(nameKey);
      const buyerSends = sendsByBuyer.get(nameKey) || [];

      const uniqueSends = Array.from(
        new Map(buyerSends.map((s) => [s.id, s])).values()
      );

      entry.stats.shortlists = uniqueSends.length;

      for (const buyerSend of uniqueSends) {
        applySendToEntry(entry, buyerSend);
      }

      buildPriceSignal(entry.stats);
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
      status: 200
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Could not load buyers"
      }),
      { status: 500 }
    );
  }
};