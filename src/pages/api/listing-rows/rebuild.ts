import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const clean = (value: any) =>
  String(value || "").toLowerCase().trim();

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
  if (raw.startsWith("/vreb/")) return `https://cdn.repliers.io${raw}`;

  return raw;
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

const getPrice = (listing: any) =>
  Number(
    listing.price ||
      listing.listPrice ||
      listing.priceNumber ||
      listing.raw?.listPrice ||
      0
  );

const getImage = (listing: any) =>
  normalizeImageUrl(
    listing.image_url ||
      listing.image ||
      listing.photo ||
      listing.images?.[0] ||
      listing.raw?.images?.[0]?.url ||
      listing.raw?.images?.[0]
  );

const getAddress = (listing: any) =>
  listing.address ||
  listing.full_address ||
  listing.addressText ||
  listing.addressObj?.streetAddress ||
  [
    listing.addressObj?.streetNumber,
    listing.addressObj?.streetName,
    listing.addressObj?.streetSuffix
  ]
    .filter(Boolean)
    .join(" ") ||
  "Address available";

const getDescription = (listing: any) =>
  listing.description ||
  listing.publicRemarks ||
  listing.remarks ||
  listing.details?.description ||
  listing.details?.publicRemarks ||
  listing.raw?.description ||
  listing.raw?.publicRemarks ||
  listing.raw?.details?.description ||
  "";

const getType = (listing: any) =>
  clean(
    listing.normalized_type ||
      listing.property_type ||
      listing.propertyType ||
      listing.type ||
      listing.details?.propertyType ||
      listing.raw?.details?.propertyType ||
      ""
  );

export const GET: APIRoute = async () => {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("listing_snapshots")
      .select("id, created_at, city, listings")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    const rows = (data || [])
      .flatMap((snapshot: any) => {
        if (!Array.isArray(snapshot.listings)) return [];

        return snapshot.listings.map((listing: any) => {
          const mls = getMls(listing);

          const city =
            listing.city ||
            listing.addressObj?.city ||
            listing.address?.city ||
            listing.raw?.address?.city ||
            snapshot.city ||
            "";

          const normalizedCity =
            listing.normalized_city ||
            snapshot.city ||
            city;

          const area =
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

          return {
            id: String(
              mls ||
                listing.id ||
                listing.repliers_listing_id ||
                listing.raw?.id ||
                ""
            ).trim(),
            mls_number: mls,
            city,
            normalized_city: clean(normalizedCity),
            area,
            normalized_type: getType(listing),
            property_type:
              listing.property_type ||
              listing.propertyType ||
              listing.type ||
              listing.details?.propertyType ||
              listing.raw?.details?.propertyType ||
              "",
            price: getPrice(listing),
            beds: Number(
              listing.beds ||
                listing.bedrooms ||
                listing.details?.numBedrooms ||
                listing.raw?.details?.numBedrooms ||
                0
            ),
            baths: Number(
              listing.baths ||
                listing.bathrooms ||
                listing.details?.numBathrooms ||
                listing.raw?.details?.numBathrooms ||
                0
            ),
            sqft:
              Number(
                String(
                  listing.sqft ||
                    listing.square_feet ||
                    listing.squareFeet ||
                    listing.details?.sqft ||
                    listing.raw?.details?.sqft ||
                    ""
                ).replace(/[^0-9.]/g, "")
              ) || null,
            address: getAddress(listing),
            description: getDescription(listing),
            image_url: getImage(listing),
            images: [],
            raw: null,
            listed_at:
              listing.listed_at ||
              listing.list_date ||
              listing.listDate ||
              listing.created_at ||
              listing.raw?.timestamps?.listingUpdated ||
              snapshot.created_at
          };
        });
      })
      .filter((row: any) => row.id);

    const limitedRows = rows.slice(0, 25);

    console.log("listing_rows rebuild total found:", rows.length);
    console.log("listing_rows rebuild limited:", limitedRows.length);

    const BATCH_SIZE = 25;

    for (let i = 0; i < limitedRows.length; i += BATCH_SIZE) {
      const batch = limitedRows.slice(i, i + BATCH_SIZE);

      const { error: batchError } = await supabase
        .from("listing_rows")
        .upsert(batch, { onConflict: "id" });

      if (batchError) {
        throw batchError;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        count: limitedRows.length,
        totalFound: rows.length
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Could not rebuild listing rows"
      }),
      { status: 500 }
    );
  }
};