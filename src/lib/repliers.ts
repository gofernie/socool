import { createClient } from "@supabase/supabase-js";

export type RepliersListing = {
  id?: string;
  mlsNumber?: string;
  listPrice?: number;
  status?: string;
  class?: string;
  type?: string;
  propertyType?: string;
  propertySubType?: string;
  subType?: string;
  style?: string;
  daysOnMarket?: number | string;
  dom?: number | string;
  details?: {
    numBedrooms?: string | number;
    numBathrooms?: string | number;
    propertyType?: string;
    propertySubType?: string;
    subType?: string;
    style?: string;
    description?: string;
    sqft?: string | number;
    yearBuilt?: string | number;
    daysOnMarket?: number | string;
    dom?: number | string;
  };
  address?: {
    streetNumber?: string;
    streetName?: string;
    streetSuffix?: string;
    unitNumber?: string;
    city?: string;
    area?: string;
  };
  images?: Array<
    | string
    | {
        url?: string;
        highRes?: string;
        mediumRes?: string;
        lowRes?: string;
      }
  >;
  rooms?: any[];
  publicRemarks?: string;
  remarks?: string;
};

type RepliersListingsResponse = {
  listings?: RepliersListing[];
  count?: number;
  page?: number;
  totalPages?: number;
};

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      qs.set(key, String(value));
    }
  }

  return qs.toString();
}

function normalizeImageUrl(url?: string) {
  const value = String(url || "").trim();

  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `https://cdn.repliers.io${value}`;
  }

  return `https://cdn.repliers.io/${value.replace(/^\/+/, "")}`;
}

function getTypeQuery(type?: string) {
  if (!type) return {};

  if (type === "Condo") {
    return {
      class: "Residential",
      propertyType: "Condo",
      propertySubType: "Condo"
    };
  }

  if (type === "Detached") {
    return {
      class: "Residential",
      propertyType: "House",
      propertySubType: "Single Family"
    };
  }

  if (type === "Townhouse") {
    return {
      class: "Residential",
      propertyType: "Townhouse",
      propertySubType: "Townhouse"
    };
  }

  if (type === "Land") {
    return {
      class: "Land",
      propertyType: "Vacant Land",
      propertySubType: "Vacant Land"
    };
  }

  return {};
}

type FetchParams = {
  city?: string;
  area?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  beds?: number | string;
  baths?: number | string;
  type?: string;
  page?: number;
  limit?: number;
};

function buildSearchKey(params: FetchParams) {
  return JSON.stringify({
    city: params.city || "",
    area: params.area || "",
    minPrice: params.minPrice || "",
    maxPrice: params.maxPrice || "",
    beds: params.beds || "",
    baths: params.baths || "",
    type: params.type || "",
    page: params.page || 1,
    limit: params.limit || 50
  });
}

async function fetchRepliersListingsLive(
  params: FetchParams
): Promise<RepliersListingsResponse> {
  const apiKey = import.meta.env.REPLIERS_API_KEY;
  const baseUrl = import.meta.env.REPLIERS_BASE_URL || "https://api.repliers.io";

  if (!apiKey) {
    throw new Error("Missing REPLIERS_API_KEY");
  }

  const typeQuery = getTypeQuery(params.type);

  const query = buildQuery({
    ...(params.city ? { city: params.city } : {}),
    ...(params.area ? { area: params.area } : {}),

    ...(params.minPrice ? { minPrice: params.minPrice } : {}),
    ...(params.maxPrice ? { maxPrice: params.maxPrice } : {}),

    ...(params.beds ? { minBedrooms: params.beds } : {}),
    ...(params.baths ? { minBaths: params.baths } : {}),

    ...typeQuery,

    pageNum: params.page ?? 1,
    resultsPerPage: params.limit ?? 50,

    hasImages: "true",
    include: "details,address,images"
  });

  console.log("REPLIERS QUERY:", query);

  const res = await fetch(`${baseUrl}/listings?${query}`, {
    method: "GET",
    headers: {
      "REPLIERS-API-KEY": apiKey,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Repliers error ${res.status}: ${text}`);
  }

  return (await res.json()) as RepliersListingsResponse;
}

export async function fetchRepliersListings(
  params: FetchParams
): Promise<RepliersListingsResponse> {
  const searchKey = buildSearchKey(params);

  const freshnessCutoff = new Date(Date.now() - 1000 * 60 * 30).toISOString();

  const { data: cached, error: cacheError } = await supabase
    .from("listing_snapshots")
    .select("*")
    .eq("search_key", searchKey)
    .gte("created_at", freshnessCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cacheError) {
    console.warn("Listing cache read error:", cacheError.message);
  }

  if (cached?.listings) {
    console.log("⚡ Using cached listings");

    return {
      listings: cached.listings,
      count: cached.result_count ?? cached.listings.length,
      page: params.page ?? 1
    };
  }

  console.log("🐢 Fetching from Repliers...");

  const live = await fetchRepliersListingsLive(params);
  const listings = live.listings || [];

  const { error: insertError } = await supabase.from("listing_snapshots").insert({
    search_key: searchKey,
    city: params.city || null,
    filters: params,
    listings,
    result_count: live.count ?? listings.length
  });

  if (insertError) {
    console.warn("Listing cache insert error:", insertError.message);
  }

  return live;
}

export function getListingId(listing?: RepliersListing) {
  if (!listing) return "";
  return listing.id || listing.mlsNumber || "";
}

export function getListingPrice(listing?: RepliersListing) {
  if (!listing) return "Price unavailable";

  const price = listing.listPrice;

  if (typeof price !== "number") return "Price unavailable";

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(price);
}

export function getListingAddress(listing?: RepliersListing) {
  if (!listing) return "Address unavailable";

  const a = listing.address || {};

  const line1 = [a.streetNumber, a.streetName, a.streetSuffix]
    .filter(Boolean)
    .join(" ");

  const unit = a.unitNumber ? `Unit ${a.unitNumber}` : "";
  const city = a.city || a.area || "";

  return [line1, unit, city].filter(Boolean).join(", ") || "Address unavailable";
}

export function getListingBeds(listing?: RepliersListing) {
  if (!listing) return "-";
  return listing.details?.numBedrooms ?? "-";
}

export function getListingBaths(listing?: RepliersListing) {
  if (!listing) return "-";
  return listing.details?.numBathrooms ?? "-";
}

export function getListingSqft(listing?: RepliersListing) {
  if (!listing) return "";
  return listing.details?.sqft ?? "";
}

export function getListingType(listing?: RepliersListing) {
  if (!listing) return "Home";

  return (
    listing.details?.propertySubType ||
    listing.details?.subType ||
    listing.propertySubType ||
    listing.subType ||
    listing.details?.style ||
    listing.style ||
    listing.details?.propertyType ||
    listing.propertyType ||
    listing.class ||
    listing.type ||
    "Home"
  );
}

export function getListingYear(listing?: RepliersListing) {
  if (!listing) return "";
  return listing.details?.yearBuilt ?? "";
}

export function getListingDaysOnMarket(listing?: RepliersListing) {
  if (!listing) return "";

  return (
    listing.details?.daysOnMarket ||
    listing.details?.dom ||
    listing.daysOnMarket ||
    listing.dom ||
    ""
  );
}

export function getListingImage(listing?: RepliersListing) {
  if (!listing) return "https://placehold.co/800x600?text=Listing";

  const first = listing.images?.[0];

  if (!first) return "https://placehold.co/800x600?text=Listing";

  if (typeof first === "string") {
    return normalizeImageUrl(first);
  }

  return normalizeImageUrl(first.highRes || first.mediumRes || first.lowRes || first.url);
}

export function getListingDescription(listing?: RepliersListing) {
  if (!listing) return "";

  return (
    listing.details?.description ||
    listing.publicRemarks ||
    listing.remarks ||
    ""
  );
}