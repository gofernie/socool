import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DOMParser } from "xmldom";
import { kml } from "@tmcw/togeojson";

const CITY = "nanaimo";
const SITE_ID = process.env.SITE_ID || "";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const KML_PATH = path.resolve("src/scripts/nanaimo-boundaries.kml");

if (!SITE_ID) throw new Error("Missing SITE_ID env var");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  const kmlText = fs.readFileSync(KML_PATH, "utf8");
  const doc = new DOMParser().parseFromString(kmlText, "text/xml");
  const geojson = kml(doc) as any;

  const lines = geojson.features.filter(
    (feature: any) => feature.geometry?.type === "LineString"
  );

  console.log(`Found ${lines.length} lines`);

  const rows = lines.map((feature: any) => ({
    site_id: SITE_ID,
    city: CITY,
    name: feature.properties?.name || null,
    geometry_geojson: feature.geometry,
  }));

  const { error } = await supabase
    .from("imported_boundary_lines")
    .insert(rows);

  if (error) throw error;

  console.log(`✅ Imported ${rows.length} boundary lines`);
}

main();