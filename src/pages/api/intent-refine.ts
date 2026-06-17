import { generateBehaviourRefineChips } from "../../lib/intent/refineChips";
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatPrice(price: number) {
  return `$${Number(price || 0).toLocaleString()}`;
}

function normalizeTags(value: any): string[] {
  if (Array.isArray(value)) return value.map(String);

  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function textIncludesAny(text: string, terms: string[]) {
  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

const tagTerms: Record<string, string[]> = {
  layout: ["layout", "open concept", "floor plan", "flow"],
  yard: ["yard", "fenced", "garden", "outdoor", "patio", "deck"],
  garage: ["garage", "shop", "parking", "carport"],
  modern: ["updated", "renovated", "modern", "newer"],
  value: ["value", "potential", "affordable"],
  suite: [
  "second kitchen",
  "2 kitchens",
  "two kitchens",
  "secondary suite",
  "legal suite",
  "unauthorized suite",
  "in-law suite",
  "mortgage helper",
  "basement suite"
],
  views: ["view", "ocean", "mountain", "water"],
  area: [],
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const city = String(body.city || "").toLowerCase();
    const refineLabel = String(body.refine_label || "").toLowerCase();
    const wantsLowerPrice =
  refineLabel.includes("lower-priced") ||
  refineLabel.includes("lower priced") ||
  refineLabel.includes("best value");

const wantsMidRange =
  refineLabel.includes("mid-range") ||
  refineLabel.includes("mid range");

const wantsPremium =
  refineLabel.includes("premium") ||
  refineLabel.includes("higher budget") ||
  refineLabel.includes("show up to");
    const sessionId = String(body.session_id || "");
    const slug = String(body.slug || "");
    let pageType = String(body.property_type || "").toLowerCase();

    const pageClues = [
      slug,
      body.page_title,
      body.hero_heading,
      body.seo_title,
      body.intent_title,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");

   let intentPage: any = null;

if (slug) {
  const { data } = await supabase
    .from("intent_pages")
    .select(`
      property_type,
      area,
      waterfront_type,
      requires_waterfront,
      requires_ocean_view
    `)
    .eq("slug", slug)
    .eq("city", city)
    .maybeSingle();

  intentPage = data || null;

  if (!pageType && intentPage?.property_type) {
    pageType = String(intentPage.property_type).toLowerCase();
  }
}

    if (!pageType && slug) {
      const { data: intentPage } = await supabase
        .from("intent_pages")
        .select("property_type")
        .eq("slug", slug)
        .maybeSingle();

      if (intentPage?.property_type) {
        pageType = String(intentPage.property_type).toLowerCase();
      }
    }

    const visibleMaxPrice = Number(body.visible_max_price || 0);
    const offset = Number(body.offset || 0);
    const limit = Number(body.limit || 24);

    const visibleListings = Array.isArray(body.visible_listings)
      ? body.visible_listings
      : [];
      const positiveReactions = Array.isArray(body.positive_reactions)
  ? body.positive_reactions
  : [];
      const mapBounds = body.map_bounds || null;

  const excludeAddresses = visibleListings
  .map((item: any) => String(item.address || "").trim())
  .filter(Boolean);

const allExcludedAddresses = new Set(excludeAddresses);

const visiblePriceByAddress = new Map(
  visibleListings
    .map((item: any) => {
      const address = String(item.address || "").trim().toLowerCase();
      const price = Number(
        String(item.price || "")
          .replace(/\$/g, "")
          .replace(/,/g, "")
      );

      return [address, price];
    })
    .filter(([address, price]) => address && Number(price) > 0)
);

    let behaviourRows: any[] = [];

    if (sessionId && slug) {
      const { data: behaviourData, error: behaviourError } = await supabase
        .from("intent_listing_reactions")
       .select(`
  decision,
  liked_tags,
  area,
  address,
  price
`)
        .eq("session_id", sessionId)
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(50);

      if (behaviourError) {
        console.error("Behaviour lookup failed:", behaviourError);
      }

      behaviourRows = behaviourData || [];
      const reactedAddresses = behaviourRows
  .map((row) => String(row.address || "").trim())
  .filter(Boolean);

reactedAddresses.forEach((address) => {
  allExcludedAddresses.add(address);
});
    }

    const generatedChips = generateBehaviourRefineChips(behaviourRows);

    const lovedTags = new Set<string>();
    const maybeTags = new Set<string>();
    const lovedAreas = new Set<string>();
const maybeAreas = new Set<string>();
const passedAreas = new Set<string>();
const positivePrices: number[] = [];
let preferredAreas: string[] = [];

    [
  ...behaviourRows,
  ...positiveReactions
].forEach((row) => {
  const decision = String(row.decision || "");
const area = String(row.area || "").toLowerCase();
const tags = normalizeTags(row.liked_tags);

const rawPrice = String(row.price || "")
  .replace(/\$/g, "")
  .replace(/,/g, "");

let price = Number(rawPrice || 0);

if (!price && row.address) {
  price = Number(
    visiblePriceByAddress.get(String(row.address || "").trim().toLowerCase()) || 0
  );
}

    if (decision === "love") {
  tags.forEach((tag) => lovedTags.add(tag));
  if (area) lovedAreas.add(area);
  if (price > 0) positivePrices.push(price);
}

if (decision === "maybe") {
  tags.forEach((tag) => maybeTags.add(tag));
  if (area) maybeAreas.add(area);
  if (price > 0) positivePrices.push(price);
}

      if (decision === "pass") {
        if (area) passedAreas.add(area);
      }
    });

    const preferredMinPrice = positivePrices.length
  ? Math.min(...positivePrices)
  : 0;

const preferredAvgPrice = positivePrices.length
  ? positivePrices.reduce((sum, price) => sum + price, 0) / positivePrices.length
  : 0;
  const priceBandRule = body.price_band_rule || {};

const priceDelta = Math.min(
  preferredAvgPrice * Number(priceBandRule.percent || 0.3),
  Number(priceBandRule.max_delta || 175000)
);

const minPreferredPrice =
  preferredAvgPrice > 0
    ? Math.round(preferredAvgPrice - priceDelta)
    : 0;

const maxPreferredPrice =
  preferredAvgPrice > 0
    ? Math.round(preferredAvgPrice + priceDelta)
    : 0;

const anchorPrice = positivePrices.length
  ? Math.max(...positivePrices)
  : 0;
let query = supabase
      .from("listing_rows")
      .select("*")
      .eq("status", "A")
      .eq("normalized_city", city);

   const propertyTypeMap: Record<string, string> = {
  home: "house",
  homes: "house",
  house: "house",
  houses: "house",
  condo: "condo",
  condos: "condo",
  apartment: "condo",
  apartments: "condo",
  townhome: "townhouse",
  townhomes: "townhouse",
  townhouse: "townhouse",
  townhouses: "townhouse",
  mobile: "mobile",
  manufactured: "mobile",
  land: "land",
};

const lockedPageType =
  propertyTypeMap[pageType] || pageType;

// Do not hard-filter property type during refine.
// First return listings in the liked/loved price band.
// Then boost same-type listings in scoring.
if (lockedPageType) {
  console.log("REFINE PREFERRED PROPERTY TYPE:", lockedPageType);
}

const totalPositiveSignals =
  behaviourRows.filter((row) =>
    ["love", "maybe"].includes(String(row.decision || ""))
  ).length +
  positiveReactions.filter((row) =>
    ["love", "maybe"].includes(String(row.decision || ""))
  ).length;

if (
  intentPage?.area &&
  totalPositiveSignals < 2
) {
  query = query.eq(
    "normalized_area",
    String(intentPage.area).toLowerCase().trim()
  );
}

// Do not hard-filter waterfront / ocean view during behavioural refine.
// Buyers may like "close to ocean" without needing MLS waterfront/ocean_view flags.
// These should be scored later, not required here.

   const lowerCeiling =
  visibleMaxPrice > 0
    ? Math.round(visibleMaxPrice * 0.35)
    : 700000;

const midFloor =
  visibleMaxPrice > 0 ? Math.round(visibleMaxPrice * 0.55) : 700000;

const midCeiling =
  visibleMaxPrice > 0 ? Math.round(visibleMaxPrice * 0.78) : 950000;

const premiumFloor =
  visibleMaxPrice > 0 ? Math.round(visibleMaxPrice * 0.78) : 950000;

if (wantsLowerPrice) {
  query = query.lte("price", lowerCeiling);
}

if (wantsMidRange) {
  query = query.gte("price", midFloor).lte("price", midCeiling);
}

if (wantsPremium) {
  query = query.gte("price", premiumFloor);
}

let targetMaxPrice =
  visibleMaxPrice > 0
    ? Math.min(
        Math.round(visibleMaxPrice * 1.20),
        visibleMaxPrice + 200000
      )
    : 0;

    if (refineLabel.includes("stay close")) {
      targetMaxPrice = visibleMaxPrice;
    }

    const explicitPriceMatch = refineLabel.match(/show up to\s+\$?([\d,]+)/i);

    if (explicitPriceMatch?.[1]) {
      targetMaxPrice = Number(explicitPriceMatch[1].replace(/,/g, ""));
    }

if (
  minPreferredPrice > 0 &&
  maxPreferredPrice > 0 &&
  !wantsLowerPrice &&
  !wantsMidRange &&
  !wantsPremium
) {
  // Wider gate: ±40% buffer so scoring can do the real work
  query = query
    .gte("price", Math.round(minPreferredPrice * 0.6))
    .lte("price", Math.round(maxPreferredPrice * 1.4));
} else if (
  targetMaxPrice > 0 &&
  !wantsLowerPrice &&
  !wantsMidRange &&
  !wantsPremium
) {
  query = query.lte("price", targetMaxPrice);
}

      if (refineLabel.includes("show up to")) {
  const match = refineLabel.match(/[\d,]+/);
  const requestedMax = match ? Number(match[0].replace(/,/g, "")) : 0;

  if (requestedMax > 0) {
    query = query.lte("price", requestedMax);
  }
}

const preferredFeatureLabels = {
  modern: refineLabel.includes("modern"),
  yard: refineLabel.includes("yard"),
  garage: refineLabel.includes("garage"),
income:
  refineLabel.includes("income") ||
  refineLabel.includes("suite ready") ||
  refineLabel.includes("suite"),
view: refineLabel.includes("view"),
  bedrooms:
    refineLabel.includes("more bedrooms") ||
    refineLabel.includes("more beds") ||
    refineLabel.includes("bedrooms"),
};

    const stayInMatch = refineLabel.match(/stay in (.+)$/i);
const wantsNearbyAreas = refineLabel.includes("nearby");
    if (stayInMatch?.[1]) {
      const rawAreas = stayInMatch[1]
        .toLowerCase()
        .split(/\s*(?:,|\band\b)\s*/)
        .map((a) => a.trim())
        .filter(Boolean);

      const positiveBehaviourAreas = Array.from(
        new Set([...lovedAreas, ...maybeAreas])
      ).filter((area) => area && !passedAreas.has(area));

      const shouldUseBehaviourAreaGroup =
        rawAreas.length === 1 &&
        positiveBehaviourAreas.includes(rawAreas[0]) &&
        positiveBehaviourAreas.length > 1 &&
        positiveBehaviourAreas.length <= 4;

      const constrainedAreas = shouldUseBehaviourAreaGroup
        ? positiveBehaviourAreas
        : rawAreas;

      console.log("STAY IN AREAS:", constrainedAreas);

      if (constrainedAreas.length === 1) {
        query = query.eq("normalized_area", constrainedAreas[0]);
        preferredAreas = constrainedAreas;
      }

      if (constrainedAreas.length > 1) {
        preferredAreas = constrainedAreas;
      }
    }

    console.log("REFINE FINAL FILTERS:", {
      city,
      pageType,
      refineLabel,
      preferredAreas,
      visibleMaxPrice,
      targetMaxPrice,
    });

const { data, error } = await query
  .order("listed_at", { ascending: false })
  .limit(300);

let filteredData = data || [];

if (anchorPrice >= 1000000) {

  filteredData = filteredData.filter((listing) => {
    const price = Number(listing.price || 0);
    const type = String(
      listing.normalized_type ||
      listing.property_type ||
      listing.type ||
      ""
    ).toLowerCase();

    if (type.includes("mobile")) return false;
    if (type.includes("land") || type.includes("lot")) return false;

    return price >= anchorPrice * 0.7;
  });

  console.log("ANCHOR PRICE FILTER", anchorPrice, filteredData.length);
}
/**
 * Safety lock: refined results must stay inside the intent page property type.
 * This prevents a "homes" intent from drifting into condos/mobiles/land.
 */
if (lockedPageType) {
  filteredData = filteredData.filter((listing) => {
    const type = String(
      listing.normalized_type ||
      listing.property_type ||
      listing.type ||
      ""
    ).toLowerCase();

    if (lockedPageType === "house") {
      return type === "house" || type.includes("house");
    }

    if (lockedPageType === "condo") {
      return type === "condo" || type.includes("condo") || type.includes("apartment");
    }

    if (lockedPageType === "townhouse") {
      return type === "townhouse" || type.includes("townhouse") || type.includes("townhome");
    }

    if (lockedPageType === "mobile") {
      return type === "mobile" || type.includes("mobile") || type.includes("manufactured");
    }

    if (lockedPageType === "land") {
      return type === "land" || type.includes("land") || type.includes("lot");
    }

    return type === lockedPageType;
  });

  console.log("PROPERTY TYPE HARD FILTER", lockedPageType, filteredData.length);
}



if (preferredFeatureLabels.income) {
  filteredData = filteredData.filter((listing) => {
    const text = [
      listing.description,
      listing.public_remarks,
      listing.remarks,
      listing.features,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

 return textIncludesAny(text, [
  "second kitchen",
  "2 kitchens",
  "two kitchens",
  "secondary suite",
  "legal suite",
  "unauthorized suite",
  "in-law suite",
  "inlaw suite",
  "mortgage helper",
  "basement suite",
  "nanny suite",
  "self-contained suite",
  "self contained suite"
]);
  });
}

if (mapBounds) {
  filteredData = filteredData.filter((listing) => {
    const lat = Number(listing.lat || 0);
    const lng = Number(listing.lng || 0);

    if (!lat || !lng) return false;

    return (
      lat >= Number(mapBounds.south) &&
      lat <= Number(mapBounds.north) &&
      lng >= Number(mapBounds.west) &&
      lng <= Number(mapBounds.east)
    );
  });

  console.log("MAP FILTER", filteredData.length, "listings inside viewport");
}

    if (error) {
      console.error(error);
console.log("REFINE DEBUG", {
  behaviourRows: behaviourRows.length,
  lovedAreas: [...lovedAreas],
  maybeAreas: [...maybeAreas],
  preferredAreas,
  scoredAll: scoredAll.length,
  unviewedScored: unviewedScored.length,
  finalReturned: paged.length,
});
      return new Response(
        JSON.stringify({
          listings: [],
          generated_chips: generatedChips,
          has_more: false,
          next_offset: offset,
          error: error.message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

   const wantsBeachOrViews =
  pageClues.includes("beach") ||
  pageClues.includes("ocean") ||
  pageClues.includes("view") ||
  refineLabel.includes("view") ||
  refineLabel.includes("beach") ||
  refineLabel.includes("ocean");

if (wantsBeachOrViews) {
  filteredData = filteredData.filter((listing) => {
    const type = String(
      listing.normalized_type ||
      listing.property_type ||
      ""
    ).toLowerCase();

    if (type.includes("mobile")) return false;
    if (type.includes("land") || type.includes("lot")) return false;

    return true;
  });

  console.log("BEACH / VIEW TYPE FILTER", filteredData.length);
}

const scoredAll = filteredData
  .map((listing) => {
       const description = String(listing.description || "").toLowerCase();
const area = String(
  listing.normalized_area || listing.area || ""
).toLowerCase();

const type = String(listing.normalized_type || listing.property_type || "").toLowerCase();
const viewType = String(listing.view_type || "").toLowerCase();
const waterfrontType = String(listing.waterfront_type || "").toLowerCase();

let score = 0;

        lovedTags.forEach((tag) => {
          const terms = tagTerms[tag] || [];

          if (terms.length && textIncludesAny(description, terms)) {
            score += 18;
          }

          if (tag === "area" && lovedAreas.has(area)) {
            score += 16;
          }
        });

        maybeTags.forEach((tag) => {
          const terms = tagTerms[tag] || [];

          if (terms.length && textIncludesAny(description, terms)) {
            score += 9;
          }

          if (tag === "area" && maybeAreas.has(area)) {
            score += 8;
          }
        });

        if (preferredFeatureLabels.modern && textIncludesAny(description, tagTerms.modern)) {
          score += 12;
        }

        if (preferredFeatureLabels.yard && textIncludesAny(description, tagTerms.yard)) {
          score += 12;
        }

        if (preferredFeatureLabels.garage && textIncludesAny(description, tagTerms.garage)) {
          score += 12;
        }

      if (preferredFeatureLabels.income) {
  score += 100;
}

        if (preferredFeatureLabels.view && textIncludesAny(description, tagTerms.views)) {
          score += 12;
        }

       const listingPrice = Number(listing.price || 0);

if (preferredAvgPrice > 0 && listingPrice > 0) {
  const priceDistance = Math.abs(listingPrice - preferredAvgPrice);
  const priceDistanceRatio = priceDistance / preferredAvgPrice;

  if (priceDistanceRatio <= 0.08) score += 35;
  else if (priceDistanceRatio <= 0.15) score += 24;
  else if (priceDistanceRatio <= 0.25) score += 12;

   // Strongly avoid dropping buyers far below the price band they liked,
  // unless they explicitly asked for a different price band.
  if (
    preferredMinPrice > 0 &&
    !wantsLowerPrice &&
    !wantsMidRange &&
    !wantsPremium &&
    listingPrice < preferredMinPrice * 0.85
  ) {
    score -= 35;
  }

  if (
    preferredMinPrice > 0 &&
    !wantsLowerPrice &&
    !wantsMidRange &&
    !wantsPremium &&
    listingPrice < preferredMinPrice * 0.7
  ) {
    score -= 60;
  }
}

if (lockedPageType && type === lockedPageType) score += 35;

// Area/chip is secondary — price proximity (scored above) takes priority
if (lovedAreas.has(area)) score += 20;
if (maybeAreas.has(area)) score += 10;
if (preferredAreas.includes(area)) score += 10;

if (wantsNearbyAreas) {
  const nearbyAreaGroups: Record<string, string[]> = {
    "old city": [
      "south nanaimo",
      "central nanaimo",
      "departure bay",
    ],

    "north nanaimo": [
      "uplands",
      "departure bay",
      "hammond bay",
    ],

    "departure bay": [
      "north nanaimo",
      "uplands",
      "central nanaimo",
    ],

    "south nanaimo": [
      "old city",
      "central nanaimo",
    ],

    "central nanaimo": [
      "old city",
      "departure bay",
      "uplands",
    ],
  };

  const nearbyAreas = preferredAreas.flatMap(
    (a) => nearbyAreaGroups[a] || []
  );

  if (nearbyAreas.includes(area)) {
    score += 10;
  }
}if (passedAreas.has(area)) score -= 10;

        return {
          listing,
          score,
        };
      })
      .sort((a, b) => {
  if (preferredFeatureLabels.bedrooms) {
    const bedDiff = Number(b.listing.beds || 0) - Number(a.listing.beds || 0);
    if (bedDiff !== 0) return bedDiff;
  }

  if (b.score !== a.score) return b.score - a.score;

  if (wantsLowerPrice) {
    return Number(a.listing.price || 0) - Number(b.listing.price || 0);
  }

   if (preferredAvgPrice > 0) {
    return (
      Math.abs(Number(a.listing.price || 0) - preferredAvgPrice) -
      Math.abs(Number(b.listing.price || 0) - preferredAvgPrice)
    );
  }

  return Number(a.listing.price || 0) - Number(b.listing.price || 0);
});

const unviewedScored = scoredAll.filter((item) => {
  const address = String(item.listing.address || "").trim();

  return address && !allExcludedAddresses.has(address);
});

const scored =
  unviewedScored.length >= 12
    ? unviewedScored
    : scoredAll;

const targetPrice = preferredAvgPrice || targetMaxPrice || 0;

const priceSorted = scored.sort((a, b) => {
  const priceA = Number(a.listing.price || 0);
  const priceB = Number(b.listing.price || 0);

  const priceDistanceA = targetPrice
    ? Math.abs(priceA - targetPrice)
    : 0;

  const priceDistanceB = targetPrice
    ? Math.abs(priceB - targetPrice)
    : 0;

  return (
    priceDistanceA - priceDistanceB ||
    Number(b.score || 0) - Number(a.score || 0)
  );
});

console.log("SCORED ALL", scoredAll.length);
console.log("UNVIEWED", unviewedScored.length);
console.log("FINAL", scored.length);
console.log("TARGET PRICE", targetPrice);
console.log("REFINE PRICE DEBUG", {
  preferredAvgPrice,
  preferredMinPrice,
  minPreferredPrice,
  maxPreferredPrice,
  anchorPrice,
  visibleMaxPrice,
  targetMaxPrice,
  wantsLowerPrice,
  wantsMidRange,
  wantsPremium,
  rawQueryCount: data?.length ?? 0,
  afterAnchorFilter: filteredData.length,
});

const filtered = priceSorted.map((item) => item.listing);
const paged = filtered.slice(offset, offset + limit);

    const listings = paged.map((listing) => ({
      id: listing.id,
      mls_number: listing.mls_number,
      address: listing.address,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      property_type: listing.property_type,
      normalized_type: listing.normalized_type,
      normalized_city: listing.normalized_city,
      city: listing.city,
      normalized_area: listing.normalized_area,
      area: listing.area,
      year_built: listing.year_built,
      days_on_market: listing.days_on_market,
      dom: listing.dom,
      lat: listing.lat,
      lng: listing.lng,
      description: listing.description,
      image:
        listing.image_url ||
        listing.images?.[0]?.url ||
        listing.images?.[0]?.highRes ||
        listing.images?.[0]?.mediumRes ||
        listing.images?.[0]?.lowRes ||
        listing.images?.[0],
      images: listing.images || [],
      price: listing.price,
      price_text: formatPrice(listing.price),
    }));

    return new Response(
      JSON.stringify({
        listings,
        generated_chips: generatedChips,
        has_more: filtered.length > offset + limit,
        next_offset: offset + limit,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error(error);

    return new Response(
      JSON.stringify({
        listings: [],
        generated_chips: [],
        has_more: false,
        next_offset: 0,
        error: error?.message || "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};