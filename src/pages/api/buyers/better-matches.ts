import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name } = await request.json();

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    function clean(value: any) {
      return String(value || "").trim().toLowerCase();
    }

    function parsePrice(value: any) {
      const num = Number(String(value || "").replace(/[^\d]/g, ""));
      return Number.isFinite(num) && num > 0 ? num : null;
    }

    function avg(values: number[]) {
      if (!values.length) return null;
      return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }

    function getCityFromAddress(address: any) {
      const parts = String(address || "").split(",");
      return clean(parts[parts.length - 1]);
    }

    function formatAddress(raw: any, listing: any) {
      if (typeof raw.address === "string") return raw.address;

      return (
        raw.address?.streetAddress ||
        raw.address?.full ||
        raw.address?.formatted ||
        [
          raw.address?.streetNumber,
          raw.address?.streetName,
          raw.address?.streetSuffix,
          raw.address?.unitNumber ? `Unit ${raw.address.unitNumber}` : ""
        ]
          .filter(Boolean)
          .join(" ") ||
        listing.address ||
        "Listing"
      );
    }

    function normalizeImageUrl(value: any) {
  const url = String(value || "").trim();
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.includes("repliers.io")) return `https://${url.replace(/^https?:\/\//, "")}`;

  return `https://cdn.repliers.io/${url.replace(/^\/+/, "")}`;
}

function imageFromAny(value: any): string | null {
  if (!value) return null;

  if (typeof value === "string") return normalizeImageUrl(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageFromAny(item);
      if (found) return found;
    }
  }

  if (typeof value === "object") {
    return (
      normalizeImageUrl(value.url) ||
      normalizeImageUrl(value.src) ||
      normalizeImageUrl(value.highRes) ||
      normalizeImageUrl(value.mediumRes) ||
      normalizeImageUrl(value.lowRes) ||
      normalizeImageUrl(value.large) ||
      normalizeImageUrl(value.medium) ||
      normalizeImageUrl(value.small) ||
      normalizeImageUrl(value.image) ||
      normalizeImageUrl(value.photo) ||
      null
    );
  }

  return null;
}

function getListingImages(raw: any, listing: any) {
  const first =
    imageFromAny(raw.images) ||
    imageFromAny(raw.photos) ||
    imageFromAny(raw.photoUrls) ||
    imageFromAny(raw.media?.images) ||
    imageFromAny(raw.media?.photos) ||
    imageFromAny(listing.images) ||
    imageFromAny(listing.photos);

  return first ? [first] : [];
}

    const { data: sends } = await supabase
      .from("shortlist_sends")
      .select("id, client_name, buyer_review_note")
      .ilike("client_name", `%${name}%`);

    const sendIds = (sends || []).map((s: any) => s.id);

    const { data: sentItems } = sendIds.length
      ? await supabase
          .from("shortlist_items")
          .select("*")
          .in("shortlist_send_id", sendIds)
      : { data: [] };

    const items = sentItems || [];

    const likedItems = items.filter((item: any) => {
      const decision = clean(item.decision);
      return item.is_favourite === true || decision.includes("love") || decision.includes("maybe");
    });

    const likedPrices = likedItems
      .map((item: any) => parsePrice(item.price || item.price_text))
      .filter(Boolean) as number[];

    const targetPrice = avg(likedPrices) || 500000;
    const lowPrice = Math.max(0, targetPrice - 250000);
    const highPrice = targetPrice + 250000;

    const alreadySentAddresses = new Set(
      items.map((item: any) => clean(item.address)).filter(Boolean)
    );

    const buyerCities = Array.from(
      new Set(items.map((item: any) => getCityFromAddress(item.address)).filter(Boolean))
    );

    const primaryBuyerCity = buyerCities[0] || "";

    async function getListings(usePriceFilter: boolean) {
      let query = supabase
        .from("listing_snapshots")
        .select("listings, city")
        .not("listings", "is", null)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (primaryBuyerCity) {
        query = query.ilike("city", `%${primaryBuyerCity}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];

      const flatListings = rows.flatMap((row: any) =>
        Array.isArray(row.listings)
          ? row.listings.map((listing: any) => ({
              listing,
              rowCity: row.city
            }))
          : []
      );

      const normalized = flatListings.map(({ listing, rowCity }: any) => {
        const raw = listing.raw || listing;

        const price =
          parsePrice(raw.listPrice) ||
          parsePrice(raw.price) ||
          parsePrice(raw.details?.listPrice) ||
          parsePrice(raw.details?.price) ||
          parsePrice(raw.list_price);

        return {
          id: listing.id || raw.id || raw.mlsNumber || raw.mls || crypto.randomUUID(),
          mls: raw.mlsNumber || raw.mls || listing.id || null,
          address: formatAddress(raw, listing),
          city: raw.address?.city || raw.city || rowCity || null,
          sourceCity: rowCity || null,
          price,
          priceText: price ? `$${Number(price).toLocaleString()}` : "Price unavailable",
          beds:
            raw.details?.numBedrooms ||
            raw.details?.bedrooms ||
            raw.bedrooms ||
            raw.beds ||
            null,
          baths:
            raw.details?.numBathrooms ||
            raw.details?.bathrooms ||
            raw.bathrooms ||
            raw.baths ||
            null,
      
  images:
  Array.isArray(raw.images) && raw.images.length
    ? raw.images
        .map((img: any) => {
          if (typeof img === "string") return img;

          const url =
            img?.url ||
            img?.src ||
            img?.highRes ||
            img?.medium ||
            null;

          return url;
        })
        .filter((url: any) => typeof url === "string" && url.startsWith("http"))
    : Array.isArray(raw.photos) && raw.photos.length
    ? raw.photos
        .map((img: any) => {
          if (typeof img === "string") return img;

          const url =
            img?.url ||
            img?.src ||
            img?.highRes ||
            img?.medium ||
            null;

          return url;
        })
        .filter((url: any) => typeof url === "string")
.map((url: string) => {
  if (!url) return null;

  if (url.startsWith("http")) return url;

  // handle already partially formatted paths
  if (url.includes("repliers")) return `https://${url}`;

  // default repliers CDN
  return `https://cdn.repliers.io/${url.replace(/^\/+/, "")}`;
})
.filter(Boolean)
    : [],

description: raw.description || raw.publicRemarks || null
        };
      });

      return usePriceFilter
        ? normalized.filter((listing: any) => {
            const price = parsePrice(listing.price);
            return price && price >= lowPrice && price <= highPrice;
          })
        : normalized;
    }

    let listings = await getListings(true);

    if (!listings.length) {
      listings = await getListings(false);
    }

    const buyerNote = (sends || [])
      .map((s: any) => s.buyer_review_note)
      .filter(Boolean)
      .join(" ");

    function scoreListing(listing: any) {
      const text = clean(Object.values(listing || {}).join(" "));
      const price = parsePrice(listing.price);
      const note = clean(buyerNote);

      let score = 0;

      if (price) {
        score += Math.max(0, 100 - Math.abs(price - targetPrice) / 1000);
      }

      if (note.includes("garage") && text.includes("garage")) score += 50;
      if (note.includes("parking") && text.includes("parking")) score += 35;

      if (
        (note.includes("ocean") || note.includes("view")) &&
        (text.includes("ocean") || text.includes("view") || text.includes("water"))
      ) {
        score += 50;
      }

      return score;
    }

    const matches = listings
      .filter((listing: any) => {
        const address = clean(listing.address);
        return !address || !alreadySentAddresses.has(address);
      })
      .sort((a: any, b: any) => scoreListing(b) - scoreListing(a))
      .slice(0, 3)
      .map((listing: any) => {
  const image =
    Array.isArray(listing.images) && listing.images.length
      ? listing.images[0]
      : null;

  return {
    id: listing.id,
    mls: listing.mls,
    address: listing.address || "Listing",
    price: listing.price,
    priceText:
      listing.priceText ||
      (listing.price ? `$${Number(listing.price).toLocaleString()}` : "Price unavailable"),
    beds: listing.beds,
    baths: listing.baths,
    sqft: null,
    type: null,
    city: listing.city,

    image,            // ✅ THIS is the key line
   images: getListingImages(raw, listing),

    description: listing.description
  };
});

    return new Response(
      JSON.stringify({
        ok: true,
        listings: matches,
        debug: {
          name,
          buyerCities,
          primaryBuyerCity,
          targetPrice,
          lowPrice,
          highPrice,
          listingPool: listings.length,
          alreadySent: alreadySentAddresses.size,
          matched: matches.length
        }
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Could not load better matches"
      }),
      { status: 500 }
    );
  }
};