import { createClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────

export interface AgentPage {
  agentName: string;
  agentTitle: string;
  phone: string;
  email: string;
  city: string;
  template: string;
  heroEyebrow: string;
  heroHeading: string;
  heroIntro: string;
  agentPickTitle: string;
  agentPickText: string;
  featuredListingMls: string;
  linkedinUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  socialTitle: string;
  socialIntro: string;
  socialFeedType: string;
  socialFeedUrl: string;
  socialFeedEmbed: string;
  cityIntro: string;
  cityNotes: string;
  agentBio: string;
  newListingsTitle: string;
  newListingsIntro: string;
  newListingsCity: string;
  newListingsType: string;
  newListingsMinPrice: string;
  newListingsMaxPrice: string;
  newListingsLimit: number;
  newListingsSort: string;
  groups: GroupConfig[];
}

export interface GroupConfig {
  title: string;
  kicker: string;
  text: string;
  href: string;
  city?: string;
  area?: string;
  type?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
}

export interface Agent {
  name: string;
  title: string;
  phone: string;
  email: string;
  city: string;
  bio: string;
}

export interface MarketStats {
  total: number;
  newThisWeek: number;
  avgDom: number;
}

export interface LoadedAgentPage {
  page: AgentPage;
  agent: Agent;
  groups: GroupConfig[];
  newListings: any[];
  featuredListing: any | null;
  marketStats: MarketStats;
  socialLinks: { label: string; url: string }[];
  hasSocialSection: boolean;
  newListingsHref: string;
  heroHeadingMain: string;
  heroHeadingAccent: string;
  listingCity: string;
}

// ── Fallback data ──────────────────────────────────────────────────

export const fallbackPage: AgentPage = {
  agentName: "Chris Crump",
  agentTitle: "Real Estate Advisor",
  phone: "250.619.0390",
  email: "chris@example.com",
  city: "Nanaimo",
  template: "brutal",
  heroEyebrow: "Curated by Chris Crump",
  heroHeading: "Nanaimo homes.",
  heroIntro:
    "A simple, curated place to explore homes in Nanaimo - organized by property type, price point, and what buyers are watching right now.",
  agentPickTitle: "Not a giant listing portal.",
  agentPickText: "Just the homes and categories buyers actually ask about most.",
  featuredListingMls: "",
  linkedinUrl: "",
  twitterUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  socialTitle: "Follow along.",
  socialIntro:
    "Market notes, listing updates, and local real estate context from your agent.",
  socialFeedType: "",
  socialFeedUrl: "",
  socialFeedEmbed: "",
  cityIntro:
    "Nanaimo has a mix of established neighbourhoods, newer subdivisions, condo options, waterfront pockets, and family-friendly areas.",
  cityNotes:
    "Add neighbourhood notes, buyer tips, local context, and links to popular searches here.",
  agentBio:
    "A local real estate advisor helping buyers make sense of the market with clear, curated listing guidance.",
  newListingsTitle: "New listings.",
  newListingsIntro: "The latest homes to hit the market.",
  newListingsCity: "Nanaimo",
  newListingsType: "",
  newListingsMinPrice: "",
  newListingsMaxPrice: "",
  newListingsLimit: 6,
  newListingsSort: "newest",
  groups: [
    {
      title: "Condos in Nanaimo",
      kicker: "Low-maintenance living",
      href: "/explore?city=Nanaimo&type=condo",
      text: "Explore condos close to shops, trails, the waterfront, and everyday amenities.",
    },
    {
      title: "Single-family homes",
      kicker: "Room to grow",
      href: "/explore?city=Nanaimo&type=house",
      text: "Detached homes across popular Nanaimo neighbourhoods and family-friendly pockets.",
    },
    {
      title: "Popular under $800k",
      kicker: "Buyer sweet spot",
      href: "/explore?city=Nanaimo&maxPrice=800",
      text: "Homes in one of the most watched price ranges for active buyers.",
    },
    {
      title: "New listings",
      kicker: "Fresh to market",
      href: "/explore?city=Nanaimo&sort=newest",
      text: "Recently listed homes worth watching before they get buried.",
    },
  ],
};

// ── String helpers ─────────────────────────────────────────────────

export const clean = (value: any): string =>
  String(value || "").toLowerCase().trim();

export const titleCase = (value: any): string =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

// ── Listing field extractors ───────────────────────────────────────

export const getListingMls = (listing: any): string =>
  String(
    listing.mls_number ||
      listing.mlsNumber ||
      listing.repliers_listing_id ||
      listing.raw?.mlsNumber ||
      listing.raw?.id ||
      listing.id ||
      ""
  ).replace(/[^0-9]/g, "");

export const getListingPrice = (listing: any): string => {
  const raw = listing.price ?? listing.listPrice ?? listing.priceNumber ?? null;
  const num = Number(raw);
  if (Number.isFinite(num) && num > 1000) {
    return `$${Math.round(num).toLocaleString()}`;
  }
  return listing.price_text || listing.priceText || "Price on request";
};

export const getListingAddress = (listing: any): string =>
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

export const normalizeListingImageUrl = (value: any): string => {
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

export const getListingImage = (listing: any): string => {
  const image =
    listing.image_url ||
    listing.image ||
    listing.photo ||
    listing.images?.[0] ||
    listing.images?.[1] ||
    listing.raw?.images?.[0] ||
    listing.raw?.images?.[1] ||
    listing.raw?.images?.[0]?.url ||
    listing.raw?.images?.[1]?.url;
  return normalizeListingImageUrl(image);
};

export const getListingImages = (listing: any): string[] => {
  const rawImages =
    listing.images ||
    listing.photo_urls ||
    listing.photos ||
    listing.raw?.images ||
    [];
  const images = Array.isArray(rawImages)
    ? rawImages
        .map((img: any) => {
          if (typeof img === "string") return normalizeListingImageUrl(img);
          return normalizeListingImageUrl(
            img.highRes ||
              img.mediumRes ||
              img.lowRes ||
              img.url ||
              img.src ||
              img.href ||
              img.path ||
              ""
          );
        })
        .filter(Boolean)
    : [];
  const firstImage = getListingImage(listing);
  return Array.from(new Set([firstImage, ...images].filter(Boolean)));
};

export const getListingBeds = (listing: any): number =>
  listing.beds ||
  listing.bedrooms ||
  listing.details?.numBedrooms ||
  listing.raw?.details?.numBedrooms ||
  0;

export const getListingBaths = (listing: any): number =>
  listing.baths ||
  listing.bathrooms ||
  listing.details?.numBathrooms ||
  listing.raw?.details?.numBathrooms ||
  0;

export const getListingSqft = (listing: any): string =>
  listing.sqft ||
  listing.square_feet ||
  listing.squareFeet ||
  listing.details?.sqft ||
  listing.details?.squareFeet ||
  listing.raw?.details?.sqft ||
  listing.raw?.details?.squareFeet ||
  "";

export const getListingYearBuilt = (listing: any): string =>
  listing.year_built ||
  listing.yearBuilt ||
  listing.details?.yearBuilt ||
  listing.raw?.details?.yearBuilt ||
  "";

export const getListingLotSize = (listing: any): string =>
  listing.lot_size ||
  listing.lotSize ||
  listing.details?.lotSize ||
  listing.raw?.details?.lotSize ||
  "";

export const getListingArea = (listing: any): string =>
  listing.normalized_area ||
  listing.area ||
  listing.neighborhood ||
  listing.addressObj?.neighborhood ||
  listing.address?.neighborhood ||
  listing.details?.area ||
  listing.details?.subArea ||
  listing.raw?.address?.neighborhood ||
  listing.raw?.details?.area ||
  listing.raw?.details?.subArea ||
  "";

export const getListingPropertyType = (listing: any): string =>
  titleCase(
    listing.normalized_type ||
      listing.property_type ||
      listing.propertyType ||
      listing.type ||
      listing.details?.propertyType ||
      listing.raw?.details?.propertyType ||
      ""
  );

export const getListingDom = (listing: any): number | string => {
  const direct =
    listing.days_on_market ||
    listing.daysOnMarket ||
    listing.dom ||
    listing.daysOnMarketText ||
    listing.details?.daysOnMarket ||
    listing.details?.dom ||
    listing.raw?.daysOnMarket ||
    listing.raw?.dom ||
    listing.raw?.details?.daysOnMarket ||
    listing.raw?.details?.dom;
  if (direct) return direct;
  const listedRaw =
    listing.listed_at ||
    listing.list_date ||
    listing.listDate ||
    listing.created_at ||
    listing.raw?.listDate ||
    listing.raw?.list_date ||
    listing.raw?.timestamps?.listingUpdated;
  const listedTime = new Date(listedRaw).getTime();
  if (!listedTime) return "";
  return Math.max(0, Math.floor((Date.now() - listedTime) / 86400000));
};

export const getListingDescription = (listing: any): string =>
  listing.description ||
  listing.publicRemarks ||
  listing.remarks ||
  listing.details?.description ||
  listing.details?.publicRemarks ||
  listing.details?.remarks ||
  listing.raw?.description ||
  listing.raw?.publicRemarks ||
  listing.raw?.remarks ||
  listing.raw?.details?.description ||
  listing.raw?.details?.publicRemarks ||
  listing.raw?.details?.remarks ||
  "A quick preview of this property.";

export const getListingDate = (listing: any): number => {
  const raw =
    listing.listed_at ||
    listing.list_date ||
    listing.listDate ||
    listing.created_at ||
    listing.updated_at ||
    listing.raw?.timestamps?.listingUpdated ||
    0;
  return new Date(raw).getTime() || 0;
};

// ── Highlights ─────────────────────────────────────────────────────

export const buildListingHighlights = (listing: any): string[] => {
  const desc = String(getListingDescription(listing) || "").toLowerCase();
  const propertyType = String(getListingPropertyType(listing) || "").toLowerCase();
  const highlights: string[] = [];
  const sqft = Number(String(getListingSqft(listing) || "").replace(/[^0-9.]/g, ""));
  const beds = Number(getListingBeds(listing));

  const isCondo = propertyType.includes("condo") || propertyType.includes("apartment");
  const isTownhouse = propertyType.includes("townhouse") || propertyType.includes("townhome") || propertyType.includes("row");
  const isHouse = propertyType.includes("house") || propertyType.includes("detached") || propertyType.includes("single family");

  const hasView = /ocean view|water view|harbour view|harbor view|sea view|lake view|mountain view|city view|panoramic view/.test(desc) && !/viewing|preview|virtual tour|view today|viewing appointment/.test(desc);
  const hasSuite = /suite|mortgage helper|income|secondary suite|legal suite/.test(desc);
  const isUpdated = /renovated|updated|modernized|new kitchen|new roof|contemporary/.test(desc);
  const hasParking = /garage|rv parking|double garage|underground parking|secure parking/.test(desc);
  const quiet = /cul-de-sac|quiet street|private|privacy/.test(desc);
  const amenities = /pool|gym|fitness|clubhouse|elevator|storage locker|amenities/.test(desc);
  const outdoor = /patio|balcony|deck|yard|garden|outdoor space/.test(desc);

  if (isCondo) {
    if (hasView) highlights.push("Open outlook");
    if (amenities) highlights.push("Building amenities");
    if (hasParking) highlights.push("Parking included");
    if (outdoor) highlights.push("Outdoor space");
    if (isUpdated) highlights.push("Updated interior");
    if (sqft && sqft >= 900) highlights.push("Larger layout");
    if (highlights.length === 0) highlights.push("Low-maintenance living");
  } else if (isTownhouse) {
    if (beds && beds >= 3) highlights.push("Family-friendly layout");
    if (hasParking) highlights.push("Good parking");
    if (outdoor) highlights.push("Private outdoor space");
    if (isUpdated) highlights.push("Updated features");
    if (quiet) highlights.push("Quieter setting");
    if (sqft && sqft >= 1600) highlights.push("Generous townhome space");
    highlights.push("Lock-and-leave option");
  } else if (isHouse) {
    if (sqft && sqft >= 2500) highlights.push("Generous floor plan");
    if (beds && beds >= 4) highlights.push("Family-sized");
    if (hasView) highlights.push("View potential");
    if (hasSuite) highlights.push("Suite potential");
    if (isUpdated) highlights.push("Updated features");
    if (quiet) highlights.push("Quiet setting");
    if (hasParking) highlights.push("Good parking");
  } else {
    if (hasView) highlights.push("View setting");
    if (isUpdated) highlights.push("Updated features");
    if (hasParking) highlights.push("Good parking");
    if (outdoor) highlights.push("Outdoor space");
  }

  return Array.from(new Set(highlights)).slice(0, 3);
};

// ── URL builder ────────────────────────────────────────────────────

export function buildExploreHref(group: Partial<GroupConfig>): string {
  const params = new URLSearchParams();
  if (group.city) params.set("city", group.city);
  if ((group as any).area) params.set("area", (group as any).area);
  if (group.type) params.set("type", group.type);
  if (group.minPrice) params.set("minPrice", group.minPrice);
  if (group.maxPrice) params.set("maxPrice", group.maxPrice);
  if (group.sort) params.set("sort", group.sort);
  const query = params.toString();
  return query ? `/explore?${query}` : "/explore";
}

// ── Main loader ────────────────────────────────────────────────────

export async function loadAgentPage(
  slug: string,
  astro: { url: { origin: string } },
  env: { PUBLIC_SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string }
): Promise<LoadedAgentPage> {

  // ── 1. Fetch page config ─────────────────────────────────────────
  let page: AgentPage = { ...fallbackPage };

  try {
    const res = await fetch(`${astro.url.origin}/api/agent-page?slug=${slug}`);
    const json = await res.json();
    page = { ...fallbackPage, ...(json?.data || {}) };
    page.agentPickTitle = page.agentPickTitle || fallbackPage.agentPickTitle;
    page.agentPickText = page.agentPickText || fallbackPage.agentPickText;
    page.featuredListingMls = page.featuredListingMls || "";
    page.template = page.template || "brutal";
  } catch (error) {
    console.error("Could not load agent page:", error);
  }

  // ── 2. Derived values ────────────────────────────────────────────
  const agent: Agent = {
    name: page.agentName,
    title: page.agentTitle,
    phone: page.phone,
    email: page.email,
    city: page.city,
    bio: page.agentBio,
  };

  const groups: GroupConfig[] = (
    Array.isArray(page.groups) ? page.groups : fallbackPage.groups
  ).map((group) => ({
    ...group,
    href: buildExploreHref(group),
  }));

  const heroHeadingWords = String(
    page.heroHeading || `${agent.city} homes.`
  ).split(" ");
  const heroHeadingAccent = heroHeadingWords.pop() || "homes.";
  const heroHeadingMain = heroHeadingWords.join(" ") || agent.city;

  const listingCity = page.newListingsCity || agent.city || "Nanaimo";
  const listingType = page.newListingsType || "";
  const listingMinPrice = Number(page.newListingsMinPrice || 0);
  const listingMaxPrice = Number(page.newListingsMaxPrice || 0);
  const listingLimit = Number(page.newListingsLimit || 6);
  const listingSort = page.newListingsSort || "newest";

  const newListingsHref = `/explore?city=${encodeURIComponent(listingCity)}${
    listingType ? `&type=${encodeURIComponent(listingType)}` : ""
  }${listingMinPrice ? `&minPrice=${listingMinPrice}` : ""}${
    listingMaxPrice ? `&maxPrice=${listingMaxPrice}` : ""
  }&sort=newest`;

  const socialLinks = [
    { label: "LinkedIn", url: page.linkedinUrl },
    { label: "X / Twitter", url: page.twitterUrl },
    { label: "Instagram", url: page.instagramUrl },
    { label: "Facebook", url: page.facebookUrl },
  ].filter((item) => item.url);

  const hasSocialSection = socialLinks.length > 0;

  // ── 3. Supabase queries ──────────────────────────────────────────
  let newListings: any[] = [];
  let featuredListing: any | null = null;
  let marketStats: MarketStats = { total: 0, newThisWeek: 0, avgDom: 0 };

  const supabase = createClient(
    env.PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Listings
  try {
    let query = supabase
      .from("listing_rows")
      .select("*")
      .eq("status", "A")
      .limit(listingLimit);

    if (listingCity) query = query.eq("normalized_city", clean(listingCity));

    if (listingType) {
      const typeMap: Record<string, string> = {
        house: "house", detached: "house",
        condo: "condo", townhouse: "townhouse",
        land: "land", mobile: "mobile",
      };
      query = query.eq("normalized_type", typeMap[clean(listingType)] || clean(listingType));
    }

    if (listingMinPrice) query = query.gte("price", listingMinPrice * 1000);
    if (listingMaxPrice) query = query.lte("price", listingMaxPrice * 1000);

    if (listingSort === "price-low") query = query.order("price", { ascending: true });
    else if (listingSort === "price-high") query = query.order("price", { ascending: false });
    else if (listingSort === "beds-high") query = query.order("beds", { ascending: false });
    else query = query.order("listed_at", { ascending: false });

    const { data, error } = await query;
    if (error) console.error("Listings query failed:", error);
    else if (Array.isArray(data)) newListings = data;
  } catch (err) {
    console.error("Listings query error:", err);
  }

  // Featured listing
  try {
    const featuredMls = getListingMls({ repliers_listing_id: page.featuredListingMls });
    if (featuredMls) {
      const { data: featuredRows, error: featuredError } = await supabase
        .from("listing_rows")
        .select("*")
        .eq("status", "A")
        .eq("mls_number", featuredMls)
        .limit(1);

      if (featuredError) console.error("Featured listing query failed:", featuredError);
      else featuredListing = featuredRows?.[0] || null;

      if (!featuredListing) console.warn("Featured MLS not found:", featuredMls);
    }
  } catch (err) {
    console.error("Featured listing error:", err);
  }

  // Market stats
  try {
    const { data: statsRows, error: statsError } = await supabase
      .from("listing_rows")
      .select("listed_at, created_at")
      .eq("status", "A")
      .eq("normalized_city", clean(listingCity));

    if (statsError) console.error("Stats query error:", statsError);

    if (Array.isArray(statsRows) && statsRows.length > 0) {
      const total = statsRows.length;
      const sevenDaysAgo = Date.now() - 7 * 86400000;

      const newThisWeek = statsRows.filter((r) => {
        const listedRaw = r.listed_at || r.created_at;
        return listedRaw ? new Date(listedRaw).getTime() >= sevenDaysAgo : false;
      }).length;

      const doms = statsRows
        .map((r) => {
          const listedRaw = r.listed_at || r.created_at;
          if (!listedRaw) return 0;
          return Math.max(0, Math.floor((Date.now() - new Date(listedRaw).getTime()) / 86400000));
        })
        .filter((d) => d > 0);

      const avgDom = doms.length
        ? Math.round(doms.reduce((a, b) => a + b, 0) / doms.length)
        : 0;

      marketStats = { total, newThisWeek, avgDom };
    }
  } catch (err) {
    console.error("Market stats error:", err);
  }

  return {
    page,
    agent,
    groups,
    newListings,
    featuredListing,
    marketStats,
    socialLinks,
    hasSocialSection,
    newListingsHref,
    heroHeadingMain,
    heroHeadingAccent,
    listingCity,
  };
}