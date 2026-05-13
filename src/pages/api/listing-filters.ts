import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL!,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY!
);

const clean = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase();

const ALLOWED_AREAS_BY_CITY: Record<string, Set<string>> = {
  nanaimo: new Set([
    "brechin hill",
    "cedar",
    "central nanaimo",
    "chase river",
    "departure bay",
    "diver lake",
    "extension",
    "hammond bay",
        "jingle pot",
    "north jingle pot",
    "north nanaimo",
    "old city",
    "pleasant valley",
    "south jingle pot",
    "south nanaimo",
    "uplands",
    "university district"
  ])
};

function isUsableCity(city: string) {
  if (!city) return false;
  if (city.includes("{")) return false;
  if (city.includes("}")) return false;
  if (city.includes(":")) return false;
  if (city.includes('"')) return false;
  if (city.length < 2) return false;
  return true;
}

const labelize = (value: string) =>
  value
    .replace(/^na\s+/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

function isUsableArea(area: string, city: string) {
  if (!area) return false;
  if (area === city) return false;
  if (area === "other") return false;
  if (area === "unknown") return false;
  if (area.includes("{")) return false;
  if (area.includes(":")) return false;
  if (area.includes("regional district")) return false;
  if (area.includes("city of")) return false;
  if (area.includes(", city of")) return false;

  const allowedAreas = ALLOWED_AREAS_BY_CITY[city];

  if (allowedAreas && !allowedAreas.has(area)) return false;

  return true;
}

export const GET: APIRoute = async () => {
  const { data, error } = await supabase
    .from("listing_rows")
    .select("normalized_city, normalized_area, normalized_type")
    .eq("status", "A")
    .not("normalized_city", "is", null)
    .limit(10000);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const cities = new Map<string, { value: string; label: string }>();
  const types = new Map<string, { value: string; label: string }>();
  const areasByCity = new Map<
    string,
    Map<string, { value: string; label: string }>
  >();

  for (const row of data || []) {
    const city = clean(row.normalized_city);
    const area = clean(row.normalized_area);
    const type = clean(row.normalized_type);

    if (!isUsableCity(city)) continue;

    cities.set(city, {
      value: city,
      label: labelize(city)
    });

    if (!areasByCity.has(city)) {
      areasByCity.set(city, new Map());
    }

    if (isUsableArea(area, city)) {
      areasByCity.get(city)?.set(area, {
        value: area,
        label: labelize(area)
      });
    }

    if (type) {
      types.set(type, {
        value: type,
        label: labelize(type)
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      cities: Array.from(cities.values()).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      types: Array.from(types.values()).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      areasByCity: Object.fromEntries(
        Array.from(areasByCity.entries()).map(([city, areaMap]) => [
          city,
          Array.from(areaMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label)
          )
        ])
      )
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};