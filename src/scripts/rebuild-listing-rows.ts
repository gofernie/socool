import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const clean = (v: any) => String(v || "").toLowerCase().trim();

const run = async () => {
  console.log("Fetching snapshots...");

const { data, error } = await supabase
  .from("listing_snapshots")
  .select("id")
  .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  const rows: any[] = [];

  for (const snapshot of data || []) {
    if (!Array.isArray(snapshot.listings)) continue;

    for (const listing of snapshot.listings) {
      const id = String(
        listing.mls_number ||
        listing.mlsNumber ||
        listing.id ||
        listing.repliers_listing_id ||
        ""
      ).replace(/[^0-9]/g, "");

      if (!id) continue;

      rows.push({
        id,
        city: listing.city || snapshot.city,
        normalized_city: clean(listing.city || snapshot.city),
        normalized_type: clean(
          listing.property_type ||
          listing.propertyType ||
          listing.type ||
          listing.details?.propertyType
        ),
        price: Number(listing.price || listing.listPrice || 0),
        beds: Number(listing.beds || listing.bedrooms || 0),
        baths: Number(listing.baths || listing.bathrooms || 0),
        address: listing.address || "",
        image_url: listing.images?.[0] || "",
        listed_at: snapshot.created_at
      });
    }
  }

  console.log("Rows:", rows.length);

  const BATCH = 200;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    const { error: upsertError } = await supabase
      .from("listing_rows")
      .upsert(batch, { onConflict: "id" });

    if (upsertError) {
      console.error("Batch failed:", upsertError);
      return;
    }

    console.log(`Inserted ${i + batch.length}`);
  }

  console.log("Done.");
};

run();