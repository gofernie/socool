export type RepliersListing = {
  id?: string;
  mlsNumber?: string;
  listPrice?: number;
  status?: string;
  details?: {
    numBedrooms?: string | number;
    numBathrooms?: string | number;
    propertyType?: string;
    description?: string;
    sqft?: string | number;
    yearBuilt?: string | number;
  };
  address?: {
    streetNumber?: string;
    streetName?: string;
    streetSuffix?: string;
    unitNumber?: string;
    city?: string;
    area?: string;
  };
  images?: Array<{
    url?: string;
    highRes?: string;
    mediumRes?: string;
    lowRes?: string;
  }>;
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

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      qs.set(key, String(value));
    }
  }

  return qs.toString();
}

export async function fetchRepliersListings(params: {
  city?: string;
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  page?: number;
  limit?: number;
}) {
  const apiKey = import.meta.env.REPLIERS_API_KEY;
  const baseUrl = import.meta.env.REPLIERS_BASE_URL || "https://api.repliers.io";

  if (!apiKey) {
    throw new Error("Missing REPLIERS_API_KEY");
  }

const query = buildQuery({
  city: params.city,
  area: params.area,
  minPrice: params.minPrice,
  maxPrice: params.maxPrice,
  beds: params.beds,
  baths: params.baths,
  page: params.page ?? 1,
  limit: params.limit ?? 50,
  hasImages: "true",

  // 🔥 THIS IS THE CRITICAL FIX
  include: "details,address,images"
});

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

export function getListingId(listing: RepliersListing) {
  return listing.id || listing.mlsNumber || crypto.randomUUID();
}

export function getListingPrice(listing: RepliersListing) {
  const price = listing.listPrice;

  if (typeof price !== "number") return "Price unavailable";

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(price);
}

export function getListingAddress(listing: RepliersListing) {
  const a = listing.address || {};

  const line1 = [
    a.streetNumber,
    a.streetName,
    a.streetSuffix
  ].filter(Boolean).join(" ");

  const unit = a.unitNumber ? `Unit ${a.unitNumber}` : "";
  const city = a.city || a.area || "";

  return [line1, unit, city].filter(Boolean).join(", ") || "Address unavailable";
}

export function getListingBeds(listing: RepliersListing) {
  return listing.details?.numBedrooms ?? "-";
}

export function getListingBaths(listing: RepliersListing) {
  return listing.details?.numBathrooms ?? "-";
}

export function getListingSqft(listing: RepliersListing) {
  return listing.details?.sqft ?? "";
}

export function getListingType(listing: RepliersListing) {
  return listing.details?.propertyType ?? "Home";
}

export function getListingYear(listing: RepliersListing) {
  return listing.details?.yearBuilt ?? "";
}

export function getListingImage(listing: RepliersListing) {
  const first = listing.images?.[0];
  return (
    first?.highRes ||
    first?.mediumRes ||
    first?.lowRes ||
    first?.url ||
    "https://placehold.co/800x600?text=Listing"
  );
}

export function getListingDescription(listing: RepliersListing) {
  return (
    listing.details?.description ||
    listing.publicRemarks ||
    listing.remarks ||
    "A quick preview of this property."
  );
}