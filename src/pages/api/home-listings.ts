import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const clean = (value: any) =>
  String(value || "")
    .toLowerCase()
    .trim();

const normalizeImageUrl = (value: any) => {
  if (!value) return "";

  const raw =
    typeof value === "string"
      ? value
      : value.highRes ||
        value.mediumRes ||
        value.lowRes ||
        value.url ||
        value.src ||
        value.href ||
        value.path ||
        "";

  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const cleaned = raw.startsWith("/") ? raw : `/${raw}`;
  if (cleaned.startsWith("/vreb/")) return `https://cdn.repliers.io${cleaned}`;

  return cleaned;
};

const getImage = (listing: any) =>
  normalizeImageUrl(
    listing.image_url ||
      listing.image ||
      listing.photo ||
      listing.images?.[0] ||
      listing.images?.[1] ||
      listing.raw?.images?.[0] ||
      listing.raw?.images?.[1] ||
      listing.raw?.images?.[0]?.url ||
      listing.raw?.images?.[1]?.url
  );

const getImages = (listing: any) => {
  const rawImages =
    listing.images ||
    listing.photo_urls ||
    listing.photos ||
    listing.raw?.images ||
    [];

  const images = Array.isArray(rawImages)
    ? rawImages
        .map((img: any) =>
          typeof img === "string"
            ? normalizeImageUrl(img)
            : normalizeImageUrl(
                img.highRes ||
                  img.mediumRes ||
                  img.lowRes ||
                  img.url ||
                  img.src ||
                  img.href ||
                  img.path ||
                  ""
              )
        )
        .filter(Boolean)
    : [];

  return Array.from(new Set([getImage(listing), ...images].filter(Boolean)));
};

const getAddress = (listing: any) =>
  listing.address ||
  listing.full_address ||
  listing.addressText ||
  listing.addressObj?.streetAddress ||
  [
    listing.addressObj?.streetNumber,
    listing.addressObj?.streetName,
    listing.addressObj?.streetSuffix,
  ]
    .filter(Boolean)
    .join(" ") ||
  "Address available";

const getPriceText = (listing: any) => {
  const price = Number(listing.price || 0);
  if (Number.isFinite(price) && price > 1000) {
    return `$${Math.round(price).toLocaleString()}`;
  }

  return listing.price_text || listing.priceText || "Price on request";
};

const getMls = (listing: any) =>
  String(
    listing.mls_number ||
      listing.mlsNumber ||
      listing.id ||
      listing.repliers_listing_id ||
      listing.raw?.mlsNumber ||
      listing.raw?.id ||
      ""
  ).replace(/[^0-9]/g, "");

const shapeListing = (listing: any) => {
  const beds =
    listing.beds ||
    listing.bedrooms ||
    listing.details?.numBedrooms ||
    listing.raw?.details?.numBedrooms ||
    0;

  const baths =
    listing.baths ||
    listing.bathrooms ||
    listing.details?.numBathrooms ||
    listing.raw?.details?.numBathrooms ||
    0;

  const sqft =
    listing.sqft ||
    listing.square_feet ||
    listing.squareFeet ||
    listing.details?.sqft ||
    listing.details?.squareFeet ||
    listing.raw?.details?.sqft ||
    listing.raw?.details?.squareFeet ||
    "";

  return {
    id: String(listing.id || listing.mls_number || ""),
    mls: getMls(listing),
    price: getPriceText(listing),
    rawPrice: Number(listing.price || 0),
    listedAt: listing.listed_at || listing.created_at || "",
    address: getAddress(listing),
    image: getImage(listing),
    images: getImages(listing),
    beds,
    baths,
    sqft,
    description:
      listing.description ||
      listing.publicRemarks ||
      listing.remarks ||
      listing.raw?.description ||
      listing.raw?.publicRemarks ||
      listing.raw?.remarks ||
      "A quiet preview of this property.",
    propertyType:
      listing.normalized_type ||
      listing.property_type ||
      listing.propertyType ||
      listing.type ||
      "Home",
    type: listing.normalized_type || "",
    area: listing.normalized_area || listing.area || "",
    year: listing.year_built || listing.yearBuilt || "",
    lotSize: listing.lot_size || listing.lotSize || "",
    lat: listing.lat || "",
    lng: listing.lng || "",
    city: listing.normalized_city || listing.city || "",
  };
};

function pointInRing(point: [number, number], ring: any[]) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

function polygonContainsPoint(geojson: any, lat: number, lng: number) {
  if (!geojson) return false;

  const geometry = geojson.type === "Feature" ? geojson.geometry : geojson;
  if (!geometry) return false;

  const point: [number, number] = [lng, lat];

  if (geometry.type === "Polygon") {
    return pointInRing(point, geometry.coordinates?.[0] || []);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((poly: any[]) =>
      pointInRing(point, poly?.[0] || [])
    );
  }

  return false;
}

const FEATURE_TERMS: Record<string, string[]> = {
  views: ["view", "views", "ocean view", "water view", "mountain view"],
  garage: ["garage", "double garage", "attached garage", "shop"],
  yard: ["yard", "fenced", "garden", "outdoor space", "backyard"],
  suite: ["suite", "income", "mortgage helper", "secondary suite"],
  updated: ["updated", "renovated", "modern", "turnkey"],
  walkability: ["walkable", "walk to", "near shops", "close to amenities"],
};

export const GET: APIRoute = async ({ url }) => {
  const city = clean(url.searchParams.get("city") || "nanaimo");
  const area = clean(url.searchParams.get("area") || "");
  const type = clean(url.searchParams.get("type") || "");
  const maxPrice = Number(url.searchParams.get("maxPrice") || 0);
  const sort = clean(url.searchParams.get("sort") || "newest");
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const limit = Math.min(24, Math.max(8, Number(url.searchParams.get("limit") || 12)));

  const features = clean(url.searchParams.get("features") || "")
    .split(",")
    .map((feature) => clean(feature))
    .filter(Boolean);

  let areaBoundary: any = null;

  if (area) {
    const { data: boundary } = await supabase
      .from("area_boundaries")
      .select("polygon_geojson")
      .eq("city", city)
      .eq("area_slug", area.replace(/\s+/g, "-"))
      .maybeSingle();

    areaBoundary = boundary?.polygon_geojson || null;
  }

  let query = supabase
    .from("listing_rows")
    .select("*", { count: "exact" })
    .eq("status", "A")
    .eq("normalized_city", city);

  if (area && !areaBoundary) query = query.eq("normalized_area", area);
  if (type) query = query.eq("normalized_type", type);
  if (maxPrice) query = query.lte("price", maxPrice * 1000);

  if (sort === "price-low") {
    query = query.order("price", { ascending: true });
  } else if (sort === "price-high") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("listed_at", { ascending: false });
  }

  if (areaBoundary || features.length) {
    query = query.range(0, 999);
  } else {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message, listings: [], count: 0 }),
      { status: 500 }
    );
  }

  let filteredData = data || [];

  if (areaBoundary) {
    filteredData = filteredData.filter((listing: any) => {
      const lat = Number(listing.lat || 0);
      const lng = Number(listing.lng || 0);

      if (!lat || !lng) return false;

      return polygonContainsPoint(areaBoundary, lat, lng);
    });
  }

  if (features.length) {
    filteredData = filteredData.filter((listing: any) => {
      const text = [
        listing.description,
        listing.publicRemarks,
        listing.remarks,
        listing.address,
        listing.normalized_area,
        listing.area,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return features.every((feature) => {
        const terms = FEATURE_TERMS[feature] || [feature];
        return terms.some((term) => text.includes(term));
      });
    });
  }

  const totalCount = areaBoundary || features.length ? filteredData.length : count || 0;

  const pagedData =
    areaBoundary || features.length
      ? filteredData.slice(offset, offset + limit)
      : filteredData;

return new Response(
  JSON.stringify({
    listings: pagedData.map(shapeListing),
    mapListings: filteredData.map(shapeListing),
    count: totalCount,
    offset,
    limit,
  }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};