import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async () => {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("listing_snapshots")
    .select("city")
      .order("city", { ascending: true });

    if (error) throw error;

    const cities = Array.from(
      new Set(
        (data || [])
         .map((row: any) => row.city)
          .map((city: any) => String(city || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return new Response(JSON.stringify({ ok: true, cities }), {
      status: 200
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Could not load listing cities"
      }),
      { status: 500 }
    );
  }
};