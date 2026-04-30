import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async () => {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // get buyers
    const { data: buyers, error } = await supabase
      .from("buyers")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    // for each buyer, get stats
    const results = [];

    for (const buyer of buyers || []) {
      const { data: sends } = await supabase
        .from("shortlist_sends")
        .select("id, last_viewed_at")
        .eq("buyer_id", buyer.id);

      const sendIds = (sends || []).map((s) => s.id);

      let loved = 0;
      let maybe = 0;
      let notForMe = 0;

      if (sendIds.length > 0) {
        const { data: items } = await supabase
          .from("shortlist_items")
          .select("decision")
          .in("shortlist_send_id", sendIds);

        (items || []).forEach((item) => {
          if (item.decision === "love") loved++;
          if (item.decision === "maybe") maybe++;
          if (item.decision === "pass") notForMe++;
        });
      }

      const lastViewed =
        (sends || [])
          .map((s) => s.last_viewed_at)
          .filter(Boolean)
          .sort()
          .pop() || null;

      results.push({
        ...buyer,
        stats: {
          shortlists: sendIds.length,
          loved,
          maybe,
          notForMe,
          lastViewed
        }
      });
    }

    return new Response(JSON.stringify({ ok: true, buyers: results }), {
      status: 200
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500 }
    );
  }
};