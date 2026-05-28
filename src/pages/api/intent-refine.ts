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
  suite: ["suite", "income", "mortgage helper", "secondary"],
  views: ["view", "ocean", "mountain", "water"],
  area: [],
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const city = String(body.city || "").toLowerCase();
    const refineLabel = String(body.refine_label || "").toLowerCase();
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

    if (!pageType) {
      if (/\b(condo|condos|apartment|apartments)\b/.test(pageClues)) {
        pageType = "condo";
      } else if (/\b(townhouse|townhome|townhomes|townhouses)\b/.test(pageClues)) {
        pageType = "townhouse";
      } else if (/\b(mobile|mobiles|manufactured)\b/.test(pageClues)) {
        pageType = "mobile";
      } else if (/\b(single family|sfh|house|houses|home|homes)\b/.test(pageClues)) {
        pageType = "house";
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

   const excludeAddresses = visibleListings
  .map((item: any) => String(item.address || "").trim())
  .filter(Boolean);

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
    }

    const generatedChips = generateBehaviourRefineChips(behaviourRows);

    const lovedTags = new Set<string>();
    const maybeTags = new Set<string>();
    const lovedAreas = new Set<string>();
const maybeAreas = new Set<string>();
const passedAreas = new Set<string>();
const positivePrices: number[] = [];
let preferredAreas: string[] = [];

    behaviourRows.forEach((row) => {
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

let query = supabase
      .from("listing_rows")
      .select("*")
      .eq("status", "A")
      .eq("normalized_city", city);

    if (pageType) {
      console.log("REFINE LOCKED PROPERTY TYPE:", pageType);
      query = query.eq("normalized_type", pageType);
    }

    let targetMaxPrice =
      visibleMaxPrice > 0 ? Math.round(visibleMaxPrice * 1.12) : 0;

    if (refineLabel.includes("stay close")) {
      targetMaxPrice = visibleMaxPrice;
    }

    const explicitPriceMatch = refineLabel.match(/show up to\s+\$?([\d,]+)/i);

    if (explicitPriceMatch?.[1]) {
      targetMaxPrice = Number(explicitPriceMatch[1].replace(/,/g, ""));
    }

    if (targetMaxPrice > 0) {
  query = query.lte("price", targetMaxPrice);
}

// If the buyer is clearly liking higher-priced listings,
// do not let refine fall way below that band.
if (preferredMinPrice > 0) {
  query = query.gte("price", Math.round(preferredMinPrice * 0.75));
}

    if (refineLabel.includes("show up to")) {
      query = query.gt("price", visibleMaxPrice);
    }

    const preferredFeatureLabels = {
      modern: refineLabel.includes("modern"),
      yard: refineLabel.includes("yard"),
      garage: refineLabel.includes("garage"),
      income: refineLabel.includes("income"),
      view: refineLabel.includes("view"),
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
      .order("price", { ascending: false })
      .limit(120);

    if (error) {
      console.error(error);

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

    const scoredAll = (data || [])
      .map((listing) => {
        const description = String(listing.description || "").toLowerCase();
        const area = String(
          listing.normalized_area || listing.area || ""
        ).toLowerCase();

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

        if (preferredFeatureLabels.income && textIncludesAny(description, tagTerms.suite)) {
          score += 12;
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

  // Strongly avoid dropping buyers far below the price band they liked.
  if (preferredMinPrice > 0 && listingPrice < preferredMinPrice * 0.85) {
    score -= 35;
  }

  if (preferredMinPrice > 0 && listingPrice < preferredMinPrice * 0.7) {
    score -= 60;
  }
}

if (lovedAreas.has(area)) score += 12;
if (maybeAreas.has(area)) score += 6;
if (preferredAreas.includes(area)) score += 16;

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
        if (b.score !== a.score) return b.score - a.score;
        return Number(b.listing.price || 0) - Number(a.listing.price || 0);
      });

    const unviewedScored = scoredAll.filter((item) => {
      return !excludeAddresses.includes(String(item.listing.address || "").trim());
    });

    const scored = unviewedScored.length ? unviewedScored : scoredAll;

    const filtered = scored.map((item) => item.listing);
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