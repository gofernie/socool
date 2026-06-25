import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async ({ url }) => {
  const city   = url.searchParams.get("city") || "nanaimo";
  const lat    = parseFloat(url.searchParams.get("lat") || "");
  const lng    = parseFloat(url.searchParams.get("lng") || "");
  const radius = parseFloat(url.searchParams.get("radius") || "1.5");
const schoolRadius = 8;

  if (!isFinite(lat) || !isFinite(lng)) {
    return new Response(JSON.stringify({ categories: {} }), { status: 200 });
  }

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data } = await supabase
    .from("osm_amenities")
    .select("name, category, osm_type, lat, lng")
    .eq("city", city);

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const categories: Record<string, any[]> = {};

 for (const row of data || []) {
    const distKm = haversineKm(lat, lng, row.lat, row.lng);
    const effectiveRadius = row.category === "school" ? schoolRadius : radius;
    if (distKm > effectiveRadius) continue;
    if (!categories[row.category]) categories[row.category] = [];
    categories[row.category].push({ ...row, distKm });
  }

  for (const cat of Object.keys(categories)) {
    categories[cat].sort((a, b) => a.distKm - b.distKm);
    categories[cat] = categories[cat].slice(0, 5);
  }

  return new Response(JSON.stringify({ categories }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};