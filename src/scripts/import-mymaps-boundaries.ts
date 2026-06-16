import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DOMParser } from "xmldom";
import { kml } from "@tmcw/togeojson";
import slugify from "slugify";

const CITY = "nanaimo";
const SITE_ID = process.env.SITE_ID || "";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const KML_PATH = path.resolve("src/scripts/nanaimo-boundaries.kml");

if (!SITE_ID) throw new Error("Missing SITE_ID env var");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function areaSlug(name: string) {
  return slugify(name, { lower: true, strict: true });
}

function getCenter(coords: any): { lat: number; lng: number } {
  const points: [number, number][] = [];

  function walk(value: any) {
    if (!Array.isArray(value)) return;

    if (typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
      return;
    }

    value.forEach(walk);
  }

  walk(coords);

  const lng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;

  return { lat, lng };
}

async function main() {
  console.log("Reading local KML:", KML_PATH);

  if (!fs.existsSync(KML_PATH)) {
    throw new Error(`KML file not found at ${KML_PATH}`);
  }

  const kmlText = fs.readFileSync(KML_PATH, "utf8");
  const doc = new DOMParser().parseFromString(kmlText, "text/xml");
  const geojson = kml(doc) as any;

  console.log(`Found ${geojson.features.length} total features`);
for (const feature of geojson.features) {
  console.log(
    feature.properties?.name,
    "→",
    feature.geometry?.type,
    "points:",
    feature.geometry?.coordinates?.length
  );
}
  const usableFeatures = geojson.features
  .map((feature: any) => {
    const type = feature.geometry?.type;

    if (type === "Polygon" || type === "MultiPolygon") {
      return feature;
    }

    // Google My Maps often exports drawn areas as LineStrings.
    // If the line is closed, convert it into a Polygon.
    if (type === "LineString") {
      const coords = feature.geometry.coordinates || [];
      const first = coords[0];
      const last = coords[coords.length - 1];

      const isClosed =
        first &&
        last &&
        first[0] === last[0] &&
        first[1] === last[1];

      if (coords.length >= 4 && isClosed) {
        return {
          ...feature,
          geometry: {
            type: "Polygon",
            coordinates: [coords],
          },
        };
      }
    }

    return null;
  })
  .filter(Boolean);

console.log(`Found ${usableFeatures.length} usable polygon/closed-line features`);

for (const feature of usableFeatures) {
    const name = String(feature.properties?.name || "").trim();

    if (!name) {
      console.warn("Skipping unnamed polygon");
      continue;
    }

    const slug = areaSlug(name);
    const center = getCenter(feature.geometry.coordinates);

    const row = {
      site_id: SITE_ID,
      city: CITY,
      area_slug: slug,
      area_name: name,
      polygon_geojson: feature.geometry,
      center_lat: center.lat,
      center_lng: center.lng,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("area_boundaries")
      .upsert(row, {
        onConflict: "site_id,city,area_slug",
      });

    if (error) {
      console.error(`❌ ${name}`, error);
    } else {
      console.log(`✅ Imported ${name} → ${slug}`);
    }
  }
}

main();