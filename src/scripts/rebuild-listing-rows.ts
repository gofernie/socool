import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const clean = (v: any) => String(v || "").toLowerCase().trim();
const getNormalizedAddress = (listing: any) => {
  const addressObj =
    typeof listing?.address === "object" && listing.address !== null
      ? listing.address
      : null;

  const rawAddressObj =
    typeof listing?.raw?.address === "object" && listing.raw.address !== null
      ? listing.raw.address
      : null;

  const built = [
  addressObj?.unitNumber || addressObj?.unit || addressObj?.suite,
  addressObj?.streetNumber,
  addressObj?.streetName,
  addressObj?.streetSuffix
]
    .filter(Boolean)
    .join(" ")
    .trim();

  const rawBuilt = [
  rawAddressObj?.unitNumber || rawAddressObj?.unit || rawAddressObj?.suite,
  rawAddressObj?.streetNumber,
  rawAddressObj?.streetName,
  rawAddressObj?.streetSuffix
]
    .filter(Boolean)
    .join(" ")
    .trim();

  return String(
    built ||
      rawBuilt ||
      addressObj?.streetAddress ||
      rawAddressObj?.streetAddress ||
      addressObj?.full ||
      rawAddressObj?.full ||
      listing?.fullAddress ||
      listing?.addressText ||
      listing?.raw?.addressText ||
      ""
  ).trim();
};
const text = (v: any) => String(v || "").trim();

const numOrNull = (v: any) => {
  const n = Number(String(v || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

const intOrNull = (v: any) => {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
};

const getId = (listing: any) =>
  String(
    listing?.mls_number ||
      listing?.mlsNumber ||
      listing?.mls ||
      listing?.id ||
      listing?.repliers_listing_id ||
      listing?.raw?.mlsNumber ||
      ""
  ).replace(/[^0-9]/g, "");

const getAddress = (listing: any) =>
  text(
    listing?.address ||
      listing?.fullAddress ||
      listing?.details?.address ||
      listing?.address?.streetAddress ||
      listing?.address?.full ||
      listing?.raw?.address
  );

const getCity = (listing: any, snapshot: any) =>
  text(
    listing?.city ||
      listing?.address?.city ||
      listing?.details?.city ||
      listing?.raw?.city ||
      snapshot?.city
  );

const getLat = (listing: any) =>
  numOrNull(
    listing?.lat ||
      listing?.latitude ||
      listing?.map?.lat ||
      listing?.map?.latitude ||
      listing?.address?.lat ||
      listing?.address?.latitude ||
      listing?.details?.lat ||
      listing?.details?.latitude ||
      listing?.raw?.lat ||
      listing?.raw?.latitude ||
      listing?.raw?.map?.lat ||
      listing?.raw?.map?.latitude
  );

const getLng = (listing: any) =>
  numOrNull(
    listing?.lng ||
      listing?.lon ||
      listing?.longitude ||
      listing?.map?.lng ||
      listing?.map?.lon ||
      listing?.map?.longitude ||
      listing?.address?.lng ||
      listing?.address?.lon ||
      listing?.address?.longitude ||
      listing?.details?.lng ||
      listing?.details?.lon ||
      listing?.details?.longitude ||
      listing?.raw?.lng ||
      listing?.raw?.lon ||
      listing?.raw?.longitude ||
      listing?.raw?.map?.lng ||
      listing?.raw?.map?.lon ||
      listing?.raw?.map?.longitude
  );

const normalizeType = (listing: any) => {
  const raw = clean(
    [
      listing?.normalized_type,
      listing?.property_type,
      listing?.propertyType,
      listing?.type,
      listing?.class,
      listing?.style,
      listing?.details?.propertyType,
      listing?.details?.style,
      listing?.details?.type,
      listing?.details?.propertySubType,
      listing?.details?.buildingType,
      listing?.raw?.propertyType,
      listing?.raw?.type,
      listing?.raw?.details?.propertyType,
      listing?.raw?.details?.style,
      listing?.raw?.details?.type,
      listing?.raw?.details?.propertySubType,
      listing?.raw?.details?.buildingType,
      listing?.raw?.details?.sType,
      listing?.raw?.s_type,
      listing?.raw?.sType
    ]
      .filter(Boolean)
      .join(" ")
   );

  const address = clean(
    getAddress(listing) ||
      listing?.address ||
      listing?.fullAddress ||
      listing?.address?.streetAddress ||
      listing?.address?.full ||
      listing?.raw?.address ||
      ""
  );

  const FORCE_HOUSE_STREETS = [
    "maveric",
    "garside",
    "quarry",
    "nimpkish lake",
    "henderson lake",
    "cedar grove"
  ];

  if (FORCE_HOUSE_STREETS.some((street) => address.includes(street))) {
    return "house";
  }

  // Commercial stays excluded later
  if (
    raw.includes("commercial") ||
    raw.includes("office") ||
    raw.includes("retail") ||
    raw.includes("industrial") ||
    raw.includes("business")
  ) {
    return "commercial";
  }

  // Mobile MUST come before condo/house
  if (
    raw.includes("mobile") ||
    raw.includes("manufactured") ||
    raw.includes("modular") ||
    raw.includes("park model") ||
    raw.includes("manu")
  ) {
    return "mobile";
  }

  if (
    raw.includes("land") ||
    raw.includes("lot") ||
    raw.includes("acreage") ||
    raw.includes("farm")
  ) {
    return "land";
  }

  if (
    raw.includes("townhouse") ||
    raw.includes("townhome") ||
    raw.includes("row") ||
    raw.includes("patio home") ||
    raw.includes("rtwn")
  ) {
    return "townhouse";
  }

  if (
  (
    raw.includes("apartment") ||
    raw.includes("condo") ||
    raw.includes("condominium") ||
    raw.includes("apt")
  )
  &&
  !(
    raw.includes("house") ||
    raw.includes("detached") ||
    raw.includes("single family") ||
    raw.includes("bare land") ||
    raw.includes("strata house")
  )
) {
  return "condo";
}

  if (
    raw.includes("single family") ||
    raw.includes("detached") ||
    raw.includes("house") ||
    raw.includes("residential") ||
    raw.includes("sfd") ||
    raw.includes("det")
  ) {
    return "house";
  }

  if (
    raw.includes("multi-family") ||
    raw.includes("multifamily") ||
    raw.includes("multi family")
  ) {
    return "multi-family";
  }

  return "other";
};

const BUILDING_ALIASES: Record<string, string> = {
  "pacifica": "old city",
  "the 1615 residences": "old city",
  "91 chapel": "old city",
  "cameron island": "old city",
  "harbour city one": "old city",
  "prospect at harbourview district": "old city",
  "lumina at harbourview district": "old city",
  "aqua residence": "old city",
  "harbour towers": "old city",
  "channel view": "old city",

  "the fountains": "north nanaimo",
  "the texada": "north nanaimo",
  "texada": "north nanaimo",
  "long lake heights": "north nanaimo",
  "longlake heights": "north nanaimo",
  "long lake manor": "north nanaimo",
  "deerwood estates": "north nanaimo",
  "deerwood place": "north nanaimo",
  "deerwood place estates": "north nanaimo",
  "newport vista village": "north nanaimo",
  "newport": "north nanaimo",
  "royal vista": "north nanaimo",
  "oceancrest": "north nanaimo",
  "eaglepoint bayview": "north nanaimo",
  "eagle point bayview": "north nanaimo",
  "eagle point": "north nanaimo",
  "victoria estates": "north nanaimo",
  "resort on the lake": "north nanaimo",
  "the shores": "north nanaimo",
  "waterton place": "north nanaimo",

  "painted village": "south nanaimo",
  "village on third": "south nanaimo",
  "the southbend": "south nanaimo",
  "studio na": "south nanaimo",
  "timberlands mhp": "south nanaimo",

  "bowen terraces": "central nanaimo",
  "bowen terrace": "central nanaimo",
  "meredith court": "central nanaimo",

  "edgewood": "jingle pot",
  "edgewood estates": "jingle pot",
  "edgewood properties": "jingle pot",
  "songbird place": "jingle pot",

  "pacific ridge": "hammond bay",
  "rocky point": "hammond bay",
  "the plateau at rocky point": "hammond bay",
  "sunshine ridge": "hammond bay",

  "country club": "departure bay",
  "linley valley estates": "departure bay",

  "sharman mhp": "pleasant valley",

  "lumina": "old city",

  "longwood": "north nanaimo",
  "longwood estates": "north nanaimo",
  "longwood station": "north nanaimo",
  "thornbridge at longwood": "north nanaimo",
  "the met": "north nanaimo",
  "dover condos": "north nanaimo",
  "dover condominiums": "north nanaimo",
  "dover view estates": "north nanaimo",
  "winchelsea": "north nanaimo",
  "rocklands at rutherford": "north nanaimo"
};

const getBuildingName = (listing: any) => {
  const rawArea = clean(
    listing?.normalized_area ||
      listing?.area ||
      listing?.subArea ||
      listing?.neighborhood ||
      listing?.community ||
      listing?.district ||
      listing?.address?.area ||
      listing?.address?.neighborhood ||
      listing?.details?.area ||
      listing?.details?.subArea ||
      listing?.raw?.area ||
      listing?.raw?.subArea
  );

  return BUILDING_ALIASES[rawArea] ? rawArea : null;
};

const AREA_ALIASES: Record<string, Record<string, string>> = {
    nanaimo: {
    "na brechin hill": "brechin hill",
    "brechin hill": "brechin hill",

    "na cedar": "cedar",
    "cedar": "cedar",

    "na central nanaimo": "central nanaimo",
    "central nanaimo": "central nanaimo",

    "na chase river": "chase river",
    "chase river": "chase river",

    "na departure bay": "departure bay",
    "departure bay": "departure bay",

    "na diver lake": "diver lake",
    "diver lake": "diver lake",

    "na extension": "extension",
    "extension": "extension",

    "na hammond bay": "hammond bay",
    "hammond bay": "hammond bay",

    "na lower lantzville": "lower lantzville",
    "lower lantzville": "lower lantzville",

    "na north jingle pot": "north jingle pot",
    "north jingle pot": "north jingle pot",

    "na north nanaimo": "north nanaimo",
    "north nanaimo": "north nanaimo",

    "na old city": "old city",
    "old city": "old city",

    "na pleasant valley": "pleasant valley",
    "pleasant valley": "pleasant valley",

    "na south jingle pot": "south jingle pot",
    "south jingle pot": "south jingle pot",

    "na south nanaimo": "south nanaimo",
    "south nanaimo": "south nanaimo",

    "na university district": "university district",
    "university district": "university district",

    "na uplands": "uplands",
    "uplands": "uplands",

    "na upper lantzville": "upper lantzville",
    "upper lantzville": "upper lantzville"
  },

    lantzville: {
    "lantzville": "lantzville",
    "upper lantzville": "upper lantzville",
    "lower lantzville": "lower lantzville"
  },

  parksville: {
    "parksville": "parksville",
    "pa parksville": "parksville",
    "errington/coombs/hilliers": "errington coombs hilliers",
    "errington coombs hilliers": "errington coombs hilliers",
    "french creek": "french creek",
    "qualicum beach": "qualicum beach",
    "qb qualicum beach": "qualicum beach",
        "nanoose": "nanoose bay",
    "nanoose bay": "nanoose bay",
    "pa nanoose": "nanoose bay",
    "pa nanoose bay": "nanoose bay",
    "pa errington coombs hilliers": "errington coombs hilliers",
    "pa french creek": "french creek"
  }
};

const normalizeArea = (listing: any, city: string) => {
  const normalizedCity = clean(city);

  const rawArea = clean(
    listing?.normalized_area ||
      listing?.area ||
      listing?.subArea ||
      listing?.neighborhood ||
      listing?.community ||
      listing?.district ||
      listing?.address?.area ||
      listing?.address?.neighborhood ||
      listing?.details?.area ||
      listing?.details?.subArea ||
      listing?.raw?.area ||
      listing?.raw?.subArea
  );

  const haystack = clean(
    [
      rawArea,
      getNormalizedAddress(listing),
      listing?.address,
      listing?.fullAddress,
      listing?.description,
      listing?.remarks,
      listing?.publicRemarks,
      listing?.details?.description,
      listing?.raw?.description
    ]
      .filter(Boolean)
      .join(" ")
  );

  // 1. Building aliases first
  for (const [building, normalized] of Object.entries(BUILDING_ALIASES)) {
  if (rawArea === building) {
    return normalized;
  }
}

  // 2. City area aliases second
  const aliases = AREA_ALIASES[normalizedCity] || {};

  for (const [needle, normalized] of Object.entries(aliases)) {
  if (rawArea === needle) {
    return normalized;
  }
}

  // 3. Kill garbage areas
  if (
    !rawArea ||
    rawArea === normalizedCity ||
    rawArea.includes("regional district") ||
    rawArea.includes("city of") ||
    rawArea.includes(",")
  ) {
    return "unknown";
  }

  // 4. Only allow unknown areas if they look like a real named area
  return rawArea;
};

const normalizeImages = (listing: any) => {
  const candidates = [
    listing?.images,
    listing?.photo_urls,
    listing?.photos,
    listing?.imageUrls,
    listing?.raw?.images,
    listing?.raw?.photos
  ];

  const images: string[] = [];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const url =
          typeof item === "string"
            ? item
            : item?.url || item?.src || item?.href || item?.large || item?.medium;

        if (url) images.push(String(url));
      }
    }
  }

  const single =
    listing?.image_url ||
    listing?.photo_url ||
    listing?.thumbnail_url ||
    listing?.image ||
    listing?.raw?.image_url;

  if (single) images.unshift(String(single));

  return [...new Set(images.filter(Boolean))];
};

const getDescription = (listing: any) =>
  text(
    listing?.description ||
      listing?.remarks ||
      listing?.publicRemarks ||
      listing?.public_remarks ||
      listing?.marketingRemarks ||
      listing?.marketing_remarks ||
      listing?.details?.description ||
      listing?.details?.remarks ||
      listing?.details?.publicRemarks ||
      listing?.raw?.description ||
      listing?.raw?.remarks ||
      listing?.raw?.publicRemarks ||
      listing?.raw?.public_remarks ||
      listing?.raw?.marketingRemarks ||
      listing?.raw?.marketing_remarks ||
      listing?.raw?.details?.description ||
      listing?.raw?.details?.remarks ||
      listing?.raw?.details?.publicRemarks ||
      ""
  );

const getListedAt = (listing: any, snapshot: any) =>
  listing?.listed_at ||
  listing?.listedAt ||
  listing?.listDate ||
  listing?.created_at ||
  snapshot?.created_at ||
  null;

const run = async () => {
  console.log("Fetching snapshots...");

   const TARGET_CITY = process.argv[2]?.trim() || "";

  let snapshotsQuery = supabase
    .from("listing_snapshots")
    .select("id, city, search_key, created_at, listings")
    .order("created_at", { ascending: false });

  if (TARGET_CITY) {
    snapshotsQuery = snapshotsQuery.ilike("city", `%${TARGET_CITY}%`);
  }

  const { data: snapshots, error } = await snapshotsQuery.limit(20);

  if (error) {
    console.error("Snapshot fetch failed:", error);
    return;
  }

  console.log(`Snapshots found: ${snapshots?.length || 0}`);

  const { data: existingRows, error: existingError } = await supabase
    .from("listing_rows")
    .select("id, lat, lng");

  if (existingError) {
    console.error("Existing listing_rows fetch failed:", existingError);
    return;
  }

  const existingCoords = new Map(
    (existingRows || []).map((row: any) => [
      String(row.id),
      {
        lat: numOrNull(row.lat),
        lng: numOrNull(row.lng)
      }
    ])
  );

  const rowMap = new Map<string, any>();

  for (const snapshot of snapshots || []) {
    if (!Array.isArray(snapshot.listings)) continue;

    for (const listing of snapshot.listings) {
      const id = getId(listing);
      if (!id) continue;

      // Keep first version only because snapshots are newest-first.
      if (rowMap.has(id)) continue;

      const snapshotCity = text(snapshot?.city || snapshot?.search_key || "");
      const city = snapshotCity || getCity(listing, snapshot);
      const normalized_city = clean(city);
      const normalized_type = normalizeType(listing);
      // Skip commercial completely
      if (
  normalized_type === "commercial" ||
  normalized_type === "business"
) continue;

            const normalized_area = normalizeArea(listing, normalized_city);
      const images = normalizeImages(listing);

      const freshLat = getLat(listing);
      const freshLng = getLng(listing);

      const savedCoords = existingCoords.get(id);

      const lat = freshLat || savedCoords?.lat || null;
      const lng = freshLng || savedCoords?.lng || null;

      rowMap.set(id, {
        id,

        city,
        normalized_city,

        area:
          listing?.area ||
          listing?.subArea ||
          listing?.neighborhood ||
          listing?.community ||
          null,
        normalized_area,
        building_name: getBuildingName(listing),

        property_type:
          listing?.property_type ||
          listing?.propertyType ||
          listing?.type ||
          listing?.details?.propertyType ||
          null,
        normalized_type,

        price: numOrNull(listing?.price || listing?.listPrice),
        beds: intOrNull(
  listing?.beds ||
    listing?.bedrooms ||
    listing?.details?.numBedrooms ||
    listing?.details?.bedrooms ||
    listing?.raw?.details?.numBedrooms ||
    listing?.raw?.details?.bedrooms
),

baths: numOrNull(
  listing?.baths ||
    listing?.bathrooms ||
    listing?.details?.numBathrooms ||
    listing?.details?.bathrooms ||
    listing?.raw?.details?.numBathrooms ||
    listing?.raw?.details?.bathrooms
),

               address: getNormalizedAddress(listing),

        status: String(
          listing?.status ||
            listing?.mlsStatus ||
            listing?.listStatus ||
            listing?.raw?.status ||
            listing?.raw?.mlsStatus ||
            listing?.raw?.listStatus ||
            listing?.details?.status ||
            listing?.details?.mlsStatus ||
            listing?.raw?.details?.status ||
            listing?.raw?.details?.mlsStatus ||
            ""
        ).trim(),

        image_url: images[0] || null,
        images,

        description: getDescription(listing),

        listed_at: getListedAt(listing, snapshot),

        lat,
        lng
      });
    }
  }

  const rows = [...rowMap.values()];

  console.log("Rows normalized:", rows.length);

  const typeCounts: Record<string, number> = {};
  const areaCounts: Record<string, number> = {};
  let missingCoords = 0;
  let missingImages = 0;

  for (const row of rows) {
    typeCounts[row.normalized_type] = (typeCounts[row.normalized_type] || 0) + 1;
    areaCounts[row.normalized_area] = (areaCounts[row.normalized_area] || 0) + 1;

    if (!row.lat || !row.lng) missingCoords++;
    if (!row.image_url) missingImages++;
  }

  console.log("Type counts:", typeCounts);
  console.log(
    "All area counts:",
    Object.entries(areaCounts).sort((a, b) => b[1] - a[1])
  );
  console.log("Missing coords:", missingCoords);
  console.log("Missing images:", missingImages);

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

    console.log(`Upserted ${Math.min(i + batch.length, rows.length)} / ${rows.length}`);
  }

  console.log("Done.");
};

run();