import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const REPLIERS_API_KEY = import.meta.env.REPLIERS_API_KEY;
const REPLIERS_BASE_URL =
  import.meta.env.REPLIERS_BASE_URL || "https://api.repliers.io";

const MARKET_AREAS: Record<string, string[]> = {
  Nanaimo: [
    "Brechin Hill",
    "Cedar",
    "Central Nanaimo",
    "Chase River",
    "Departure Bay",
    "Diver Lake",
    "Extension",
    "Hammond Bay",
    "North Jingle Pot",
    "North Nanaimo",
    "Old City",
    "Pleasant Valley",
    "South Jingle Pot",
    "South Nanaimo",
    "University District",
    "Uplands",
    "Lower Lantzville",
    "Upper Lantzville"
  ],
  Lantzville: ["Na Lower Lantzville", "Na Upper Lantzville"],
  Duncan: [
    "Du Chemainus",
    "Du Cowichan Bay",
    "Du Cowichan Station/Glenora",
    "Du Crofton",
    "Du East Duncan",
    "Du Honeymoon Bay",
    "Du Ladysmith",
    "Du Lake Cowichan",
    "Du Saltair",
    "Du West Duncan",
    "Du Youbou"
  ],
  Parksville: [
    "PQ Bowser/Deep Bay",
    "PQ Errington/Coombs/Hilliers",
    "PQ Fairwinds",
    "PQ French Creek",
    "PQ Little Qualicum River Village",
    "PQ Nanoose",
    "PQ Parksville",
    "PQ Qualicum Beach",
    "PQ Qualicum North"
  ],
  "Qualicum Beach": [
    "PQ Bowser/Deep Bay",
    "PQ Errington/Coombs/Hilliers",
    "PQ Fairwinds",
    "PQ French Creek",
    "PQ Little Qualicum River Village",
    "PQ Nanoose",
    "PQ Parksville",
    "PQ Qualicum Beach",
    "PQ Qualicum North"
  ]
};

function clean(value: any) {
  return String(value || "").trim();
}

function cleanLower(value: any) {
  return String(value || "").toLowerCase().trim();
}

function textFrom(...values: any[]) {
  return values
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" ");
}

function getListingId(listing: any) {
  return clean(
    listing.id ||
      listing.mlsNumber ||
      listing.ml_num ||
      listing.listingId ||
      listing.mls_number ||
      listing.raw?.id ||
      listing.raw?.mlsNumber
  );
}

function getPrice(listing: any) {
  return Number(listing.listPrice || listing.price || listing.listingPrice || 0);
}

function getBeds(listing: any) {
  return Number(
    listing.details?.numBedrooms || listing.bedrooms || listing.beds || 0
  );
}

function getBaths(listing: any) {
  return Number(
    listing.details?.numBathrooms || listing.bathrooms || listing.baths || 0
  );
}

function getSqft(listing: any) {
  return (
    Number(
      String(
        listing.details?.sqft ||
          listing.details?.squareFeet ||
          listing.sqft ||
          listing.squareFeet ||
          ""
      ).replace(/[^0-9.]/g, "")
    ) || null
  );
}

function getAddress(listing: any) {
  return (
    [
      listing.address?.streetNumber,
      listing.address?.streetName,
      listing.address?.streetSuffix
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    listing.address?.streetAddress ||
    listing.address?.full ||
    listing.addressText ||
    ""
  );
}

function getCity(listing: any, fallbackCity: string) {
  return clean(listing.address?.city || listing.city || fallbackCity);
}

function normalizeArea(value: any) {
  return String(value || "")
    .toLowerCase()
    .replace(/^na\s+/i, "")
    .replace(/^du\s+/i, "")
    .replace(/^pq\s+/i, "")
    .replace(/,/g, "")
    .replace(/\bcity of\b/g, "")
    .replace(/\bdistrict of\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayArea(value: any) {
  const raw = clean(value);
  if (!raw) return "Other";

  return raw
    .replace(/^Na\s+/i, "")
    .replace(/^Du\s+/i, "")
    .replace(/^PQ\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeType(listing: any) {
  const text = textFrom(
    listing?.type,
    listing?.propertyType,
    listing?.class,
    listing?.details?.propertyType,
    listing?.details?.style,
    listing?.details?.propertySubType,
    listing?.details?.buildingType,
    listing?.details?.ownershipType,
    listing?.s_type,
    listing?.sType,
    listing?.raw?.s_type,
    listing?.raw?.sType,
    listing?.title
  );

  if (
    text.includes("commercial") ||
    text.includes("lease") ||
    text.includes("business")
  )
    return "commercial";

   if (
    text.includes("mobile") ||
    text.includes("manufactured") ||
    text.includes("modular") ||
    text.includes("park model") ||
    text.includes("mfd")
  )
    return "mobile";

  if (
    text.includes("townhouse") ||
    text.includes("townhome") ||
    text.includes("row") ||
    text.includes("rtwn")
  )
    return "townhouse";

  if (
    text.includes("duplex") ||
    text.includes("half duplex") ||
    text.includes("semi-detached")
  )
    return "duplex";

  if (
    text.includes("condo") ||
    text.includes("apartment") ||
    text.includes("apt") ||
    text.includes("unit")
  )
    return "condo";

  if (text.includes("land") || text.includes("lot")) return "land";

  if (
    text.includes("detached") ||
    text.includes("single family") ||
    text.includes("house") ||
    text.includes("sfd")
  )
    return "detached";

  return "other";
}

function getRawArea(listing: any) {
  const raw =
    listing.details?.subArea ||
    listing.details?.area ||
    listing.address?.neighborhood ||
    listing.address?.community ||
    listing.area ||
    "";

  const area = displayArea(raw);
  const normalized = normalizeArea(area);

  const AREA_ALIASES: Record<string, string> = {
    cilaire: "Departure Bay",
    brechin: "Brechin Hill"
  };

  return AREA_ALIASES[normalized] || area || "Other";
}

function normalizeImageUrl(value: any) {
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
  if (raw.startsWith("/vreb/")) return `https://cdn.repliers.io${raw}`;

  return raw;
}

function getImages(listing: any) {
  const images = listing.images || listing.photos || [];

  return Array.isArray(images)
    ? images
        .map((img: any) => normalizeImageUrl(img))
        .filter(Boolean)
    : [];
}

function getDescription(listing: any) {
  return (
    listing.description ||
    listing.publicRemarks ||
    listing.remarks ||
    listing.details?.description ||
    listing.details?.publicRemarks ||
    listing.details?.remarks ||
    listing.raw?.description ||
    listing.raw?.publicRemarks ||
    listing.raw?.remarks ||
    ""
  );
}

function getListedAt(listing: any) {
  return (
    listing.listed_at ||
    listing.list_date ||
    listing.listDate ||
    listing.timestamps?.listingUpdated ||
    listing.raw?.timestamps?.listingUpdated ||
    new Date().toISOString()
  );
}

function getPriceBucket(price: number) {
  if (!price) return "unknown";
  if (price < 500000) return "under-500k";
  if (price < 700000) return "500k-700k";
  if (price < 900000) return "700k-900k";
  if (price < 1200000) return "900k-1.2m";
  return "1.2m-plus";
}

function normalizeListing(listing: any, rawCity: string, sourceAreaOrCity: string) {
  const price = getPrice(listing);
  const normalized_type = normalizeType(listing);

  const rawArea =
    listing?.address?.area ||
    listing?.details?.subArea ||
    listing?.details?.area ||
    listing?.area ||
    sourceAreaOrCity ||
    "";

  const rawCityValue = listing?.address?.city || listing?.city || rawCity;
  const area = getRawArea({ ...listing, area: rawArea });
  const images = getImages(listing);
  const id = getListingId(listing);

  return {
    id,
    mls_number: id,
    address: getAddress(listing),

    city: getCity(listing, rawCity),
    source_city: sourceAreaOrCity,
    market_city: rawCity,

    area,

    normalized_type,
    normalized_area: normalizeArea(area),
    normalized_city: normalizeArea(rawCityValue),

    property_type:
      listing.propertyType ||
      listing.type ||
      listing.details?.propertyType ||
      normalized_type,

    price,
    price_bucket: getPriceBucket(price),

    beds: getBeds(listing),
    baths: getBaths(listing),
    sqft: getSqft(listing),

    type: normalized_type,
    raw_type: clean(listing.details?.propertyType),

    image_url: images[0] || "",
    images,
    description: getDescription(listing),
    listed_at: getListedAt(listing),

    raw: null,
    updated_at: new Date().toISOString()
  };
}

async function fetchRepliers(params: URLSearchParams) {
  const apiUrl = `${REPLIERS_BASE_URL}/listings?${params.toString()}`;

  console.log("REPLIERS QUERY:", params.toString());

  const res = await fetch(apiUrl, {
    headers: {
      "REPLIERS-API-KEY": REPLIERS_API_KEY,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Repliers error ${res.status}: ${text}`);
  }

  return await res.json();
}

function countBy(listings: any[], keyFn: (l: any) => string) {
  return listings.reduce((acc: any, l) => {
    const key = keyFn(l) || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function upsertListingRows(rows: any[]) {
  const BATCH_SIZE = 100;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from("listing_rows")
      .upsert(batch, { onConflict: "id" });

    if (error) throw error;
  }
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const rawCity = clean(url.searchParams.get("city"));

    if (!rawCity) {
      return new Response(JSON.stringify({ ok: false, error: "Missing city" }), {
        status: 400
      });
    }

    const areasToFetch =
      rawCity.toLowerCase() === "nanaimo" ? [] : MARKET_AREAS[rawCity] || [];

    const allListings: any[] = [];
    const seen = new Set<string>();

    if (areasToFetch.length > 0) {
      for (const areaName of areasToFetch) {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const params = new URLSearchParams();
          params.set("area", rawCity);
          params.set("neighborhood", areaName);
          params.set("pageNum", String(page));
          params.set("resultsPerPage", "100");
          params.set("include", "details,address,images");

          const data = await fetchRepliers(params);
          const listings = data?.listings || data?.results || data || [];

          if (!Array.isArray(listings) || listings.length === 0) break;

          for (const listing of listings) {
            const id = getListingId(listing);
            if (!id || seen.has(id)) continue;

            seen.add(id);
            allListings.push({
              ...listing,
              __sourceArea: areaName
            });
          }

          hasMore = listings.length === 100;
          page++;
        }
      }
    } else {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams();
        params.set("city", rawCity);
        params.set("pageNum", String(page));
        params.set("resultsPerPage", "100");
        params.set("include", "details,address,images");

        const data = await fetchRepliers(params);
        const listings = data?.listings || data?.results || data || [];

        if (!Array.isArray(listings) || listings.length === 0) break;

        for (const listing of listings) {
          const id = getListingId(listing);
          if (!id || seen.has(id)) continue;

          seen.add(id);
          allListings.push({
            ...listing,
            __sourceArea: rawCity
          });
        }

        hasMore = listings.length === 100;
        page++;
      }
    }

    const normalizedListings = allListings
      .map((listing) =>
        normalizeListing(listing, rawCity, listing.__sourceArea || rawCity)
      )
      .filter((listing) => listing.id);

    await upsertListingRows(normalizedListings);

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "listing_rows",
        city: rawCity,
        searchedAreas: areasToFetch.length ? areasToFetch : [rawCity],
        totalFetched: allListings.length,
        totalSaved: normalizedListings.length,
        areaCounts: countBy(normalizedListings, (listing) => listing.area),
        typeCounts: countBy(
          normalizedListings,
          (listing) => listing.normalized_type
        )
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error(error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Unknown error"
      }),
      { status: 500 }
    );
  }
};