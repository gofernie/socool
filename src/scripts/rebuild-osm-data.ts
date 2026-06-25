/**
 * rebuild-osm-data.ts
 * Fetches OSM amenities + area boundaries via Overpass API
 * and upserts into Supabase.
 *
 * Usage:
 *   npx ts-node src/scripts/rebuild-osm-data.ts
 *   npx ts-node src/scripts/rebuild-osm-data.ts --city=fernie
 *   npx ts-node src/scripts/rebuild-osm-data.ts --city=fernie --area=central
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------------------------------------------------------------------------
// Config: cities + areas to refresh
// Edit this to match your actual city/area slugs and bounding boxes.
// bbox format: south, west, north, east
// ---------------------------------------------------------------------------
const CITY_AREAS: Record<string, { areas: Record<string, { bbox: [number, number, number, number] }> }> = {
  fernie: {
    areas: {
      central:        { bbox: [49.490, -115.085, 49.510, -115.050] },
      "west-fernie":  { bbox: [49.490, -115.110, 49.510, -115.085] },
      "annex":        { bbox: [49.505, -115.075, 49.525, -115.045] },
    },
  },
  parksville: {
    areas: {
      central:        { bbox: [49.305, -124.330, 49.335, -124.290] },
      "north-end":    { bbox: [49.330, -124.330, 49.360, -124.290] },
    },
  },
nanaimo: {
    areas: {
      nanaimo: { bbox: [49.071167, -124.160614, 49.276765, -123.651123] },
    },
  },
};

// ---------------------------------------------------------------------------
// OSM category definitions
// ---------------------------------------------------------------------------
type Category = "school" | "grocery" | "transit" | "park" | "restaurant" | "medical";

const CATEGORY_QUERIES: Record<Category, string> = {
  school:     `node["amenity"~"^(school|kindergarten|college|university|prep_school)$"]; node["amenity"="school"]; way["amenity"="school"];`,
  grocery:    `node["shop"~"^(supermarket|convenience|grocery)$"]`,
  transit:    `node["highway"="bus_stop"]; node["railway"="station"];`,
  park:       `node["leisure"~"^(park|nature_reserve)$"]; way["leisure"~"^(park|nature_reserve)$"];`,
  restaurant: `node["amenity"~"^(restaurant|cafe|fast_food)$"]`,
  medical:    `node["amenity"~"^(hospital|clinic|pharmacy|doctors)$"]`,
};

// Map raw OSM tag values back to our category
const TAG_TO_CATEGORY: Record<string, Category> = {
  school: "school", kindergarten: "school",
  supermarket: "grocery", convenience: "grocery", grocery: "grocery",
  bus_stop: "transit", station: "transit",
  park: "park", nature_reserve: "park",
  restaurant: "restaurant", cafe: "restaurant", fast_food: "restaurant",
  hospital: "medical", clinic: "medical", pharmacy: "medical", doctors: "medical",
};

// ---------------------------------------------------------------------------
// Overpass helpers
// ---------------------------------------------------------------------------
function buildAmenitiesQuery(bbox: [number, number, number, number]): string {
  const b = bbox.join(",");
  const parts = Object.values(CATEGORY_QUERIES)
    .map((q) =>
      q
        .trim()
        .split(";")
        .filter(Boolean)
        .map((line) => `${line.trim()}(${b});`)
        .join("\n")
    )
    .join("\n");
  return `[out:json][timeout:30];\n(\n${parts}\n);\nout center;`;
}

function buildBoundaryQuery(areaName: string, city: string): string {
  // Try to fetch the admin boundary polygon for the area by name
  return `[out:json][timeout:30];
(
  relation["name"~"${areaName}","i"]["boundary"="administrative"];
  relation["name"~"${areaName}","i"]["place"~"suburb|neighbourhood|quarter"];
  way["name"~"${areaName}","i"]["boundary"="administrative"];
);
out geom;`;
}

async function overpassFetch(query: string): Promise<any> {
  console.log("  Query:", query.substring(0, 200));
  const params = new URLSearchParams({ data: query });
const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "User-Agent": "nuclear-neptune/1.0 (real estate data fetch)",
    },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Overpass error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Extract lat/lng from an OSM element (node, way with center, relation)
// ---------------------------------------------------------------------------
function extractLatLng(el: any): { lat: number; lng: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

// Detect which category tag applies to this element
function detectCategory(tags: Record<string, string>): Category | null {
  for (const [key, val] of Object.entries(tags)) {
    if (TAG_TO_CATEGORY[val]) return TAG_TO_CATEGORY[val];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Convert Overpass geom output to a GeoJSON Polygon/MultiPolygon
// ---------------------------------------------------------------------------
function osmToGeoJSON(elements: any[]): object | null {
  const relations = elements.filter((e) => e.type === "relation" && e.members);
  const ways = elements.filter((e) => e.type === "way" && e.geometry);

  if (relations.length > 0) {
    const rel = relations[0];
    const outerRings = rel.members
      .filter((m: any) => m.role === "outer" && m.geometry)
      .map((m: any) => m.geometry.map((p: any) => [p.lon, p.lat]));

    if (outerRings.length === 0) return null;
    return {
      type: "Feature",
      properties: { name: rel.tags?.name ?? "" },
      geometry: {
        type: outerRings.length === 1 ? "Polygon" : "MultiPolygon",
        coordinates: outerRings.length === 1 ? [outerRings[0]] : outerRings.map((r: any) => [r]),
      },
    };
  }

  if (ways.length > 0) {
    const coords = ways[0].geometry.map((p: any) => [p.lon, p.lat]);
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [coords] },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main refresh logic
// ---------------------------------------------------------------------------
async function refreshArea(city: string, area: string, bbox: [number, number, number, number]) {
  console.log(`\n→ ${city}/${area}`);

  // 1. Amenities
  console.log("  Fetching amenities...");
  const amenityData = await overpassFetch(buildAmenitiesQuery(bbox));
  const elements: any[] = amenityData.elements ?? [];

  const rows = elements
    .map((el) => {
      const pos = extractLatLng(el);
      const category = detectCategory(el.tags ?? {});
      if (!pos || !category) return null;

      // Determine the raw type tag value
      const osmType =
        el.tags?.amenity ?? el.tags?.shop ?? el.tags?.leisure ??
        el.tags?.highway ?? el.tags?.railway ?? "";

      return {
        city,
        area,
        osm_id: el.id,
        name: el.tags?.name ?? null,
        category,
        osm_type: osmType,
        lat: pos.lat,
        lng: pos.lng,
        fetched_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  // Deduplicate by osm_id before upsert
  const seen = new Set<number>();
  const dedupedRows = rows.filter((r) => {
    if (seen.has(r!.osm_id)) return false;
    seen.add(r!.osm_id);
    return true;
  });

  if (dedupedRows.length > 0) {
    const { error } = await supabase
      .from("osm_amenities")
      .upsert(dedupedRows, { onConflict: "city,area,osm_id" });
    if (error) console.error("  Amenity upsert error:", error.message);
    else console.log(`  ✓ ${dedupedRows.length} amenities upserted`);
  } else {
    console.log("  No amenities found");
  }

  // 2. Boundary
  console.log("  Fetching boundary...");
  try {
    const boundaryData = await overpassFetch(buildBoundaryQuery(area.replace(/-/g, " "), city));
    const geojson = osmToGeoJSON(boundaryData.elements ?? []);
    if (geojson) {
      const { error } = await supabase
        .from("osm_area_boundaries")
        .upsert({ city, area, geojson, fetched_at: new Date().toISOString() }, { onConflict: "city,area" });
      if (error) console.error("  Boundary upsert error:", error.message);
      else console.log("  ✓ Boundary upserted");
    } else {
      console.log("  No boundary polygon found (OSM may not have one for this area)");
    }
  } catch (e: any) {
    console.warn("  Boundary fetch failed:", e.message);
  }

  // Small delay to be polite to Overpass
  await new Promise((r) => setTimeout(r, 1500));
}

async function main() {
  const args = process.argv.slice(2);
  const cityArg = args.find((a) => a.startsWith("--city="))?.split("=")[1];
  const areaArg = args.find((a) => a.startsWith("--area="))?.split("=")[1];

  const citiesToRun = cityArg
    ? { [cityArg]: CITY_AREAS[cityArg] }
    : CITY_AREAS;

  for (const [city, config] of Object.entries(citiesToRun)) {
    if (!config) { console.warn(`Unknown city: ${city}`); continue; }
    const areasToRun = areaArg
      ? { [areaArg]: config.areas[areaArg] }
      : config.areas;

    for (const [area, { bbox }] of Object.entries(areasToRun)) {
      if (!bbox) { console.warn(`Unknown area: ${area}`); continue; }
      await refreshArea(city, area, bbox);
    }
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });