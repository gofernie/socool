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
      listing?.address?.neighborhood ||
      listing?.address?.area ||
      listing?.details?.area ||
      listing?.details?.subArea ||
      listing?.raw?.area ||
      listing?.raw?.subArea
  );



  const cleanedArea = rawArea
  .replace(/^na\s+/i, "")
  .replace(/^nanaimo\s+/i, "")
  .trim();

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

        // Cleanup aliases
    "northridge": "north nanaimo",
    "rutherford heights": "north nanaimo",
    "brechin": "brechin hill",
    "cilaire": "departure bay",
    "newcastle": "brechin hill",
    "dufferin heights": "central nanaimo",
    "hawthorne": "old city",
    "prospect": "old city",
    "coal town way": "old city",
    "vanderneuk": "south nanaimo",

    // Building / complex cleanup
    "lakeview terrace": "diver lake",
    "lakeside estates": "diver lake",
    "lakeside terrace": "diver lake",
    "cathers lake": "diver lake",

    "seascape manor": "departure bay",
    "oceanview terrace": "departure bay",
    "pacific view terrace": "departure bay",

    "rockwood heights": "old city",
    "the seven": "old city",
    "the beacon": "old city",
    "seven sails": "old city",
    "cavan place": "old city",
    "seafield place": "old city",

    "long lake heights estates": "uplands",
    "uplands estates": "uplands",
    "wellington view": "uplands",

    "peartree meadows": "pleasant valley",
    "madrona village": "pleasant valley",

    "millstream court": "south nanaimo",
    "floral woods": "south nanaimo",

    "bare land strata on strata plan": "unknown",
    "duplex": "unknown",

    // Final small-complex cleanup
    "tulsa views": "central nanaimo",
    "sherwood manor": "central nanaimo",
    "bradley manor": "central nanaimo",
    "delray place": "central nanaimo",
    "mallard place": "central nanaimo",

    "barrington": "hammond bay",
    "barrington heights": "hammond bay",
    "barrington rd": "hammond bay",
    "old victoria rd": "south nanaimo",

    "seabird mobile home park": "south nanaimo",
    "sherman mobile park": "south nanaimo",
    "willow mobile home park": "south nanaimo",
    "mountain view manufactured home parl": "south nanaimo",

    "lakeside villa": "diver lake",
    "parkridge place": "diver lake",
    "lakewood village estates": "diver lake",

    "park place": "old city",
    "ross cromarty manor": "old city",
    "malaspina estates": "old city",
    "harbour heights": "old city",

    "the willows": "pleasant valley",
    "emerald woods": "pleasant valley",

    "carmanah mews": "north nanaimo",
    "eaglepoint": "north nanaimo",
    "anderson ridge": "north nanaimo",
    "rockridge estates": "north nanaimo",
    "oceanside estates": "north nanaimo",
    "arbutus rock": "north nanaimo",

    "harbour ridge manor": "departure bay",
    "york place": "departure bay",
    "highlands": "departure bay",

    "amblewood village": "uplands",
    "prideaux gardens": "old city",
    "maveric place": "central nanaimo",
    "vivo": "old city",
    "inn of the sea": "cedar",
    "arcropolis": "old city",
    "maple tree village": "south nanaimo",

    // Remaining one-offs
    "aurora heights": "north nanaimo",
    "sherwood forest": "north jingle pot",
    "millstone pointe": "old city",
    "cedar grove villas": "cedar",
    "oakwood": "central nanaimo",
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
  },

  "campbell river": {
    "cr campbell river central": "campbell river central",
    "cr campbell river north": "campbell river north",
    "cr campbell river south": "campbell river south",
    "cr campbell river west": "campbell river west",
    "cr willow point": "willow point",

    "campbell river central": "campbell river central",
    "campbell river north": "campbell river north",
    "campbell river south": "campbell river south",
    "campbell river west": "campbell river west",
    "willow point": "willow point"
  },

  duncan: {
    "du chemainus": "chemainus",
    "du cowichan bay": "cowichan bay",
    "du cowichan station glenora": "cowichan station glenora",
    "du crofton": "crofton",
    "du east duncan": "east duncan",
    "du honeymoon bay": "honeymoon bay",
    "du ladysmith": "ladysmith",
    "du lake cowichan": "lake cowichan",
    "du saltair": "saltair",
    "du west duncan": "west duncan",
    "du youbou": "youbou",

    "chemainus": "chemainus",
    "cowichan bay": "cowichan bay",
    "cowichan station glenora": "cowichan station glenora",
    "crofton": "crofton",
    "east duncan": "east duncan",
    "honeymoon bay": "honeymoon bay",
    "ladysmith": "ladysmith",
    "lake cowichan": "lake cowichan",
    "saltair": "saltair",
    "west duncan": "west duncan",
    "youbou": "youbou"
  },

  saanich: {
    "se arbutus": "se arbutus",
    "se blenkinsop": "se blenkinsop",
    "se broadmead": "se broadmead",
    "se cadboro bay": "se cadboro bay",
    "se camosun": "se camosun",
    "se cedar hill": "se cedar hill",
    "se cordova bay": "se cordova bay",
    "se gordon head": "se gordon head",
    "se high quadra": "se high quadra",
    "se lake hill": "se lake hill",
    "se lambrick park": "se lambrick park",
    "se maplewood": "se maplewood",
    "se mt doug": "se mt doug",
    "se mt tolmie": "se mt tolmie",
    "se quadra": "se quadra",
    "se queenswood": "se queenswood",
    "se sunnymead": "se sunnymead",
    "se swan lake": "se swan lake",
    "se ten mile point": "se ten mile point",
    "sw beaver lake": "sw beaver lake",
    "sw elk lake": "sw elk lake",
    "sw gateway": "sw gateway",
    "sw glanford": "sw glanford",
    "sw gorge": "sw gorge",
    "sw granville": "sw granville",
    "sw interurban": "sw interurban",
    "sw layritz": "sw layritz",
    "sw marigold": "sw marigold",
    "sw northridge": "sw northridge",
    "sw portage inlet": "sw portage inlet",
    "sw prospect lake": "sw prospect lake",
    "sw royal oak": "sw royal oak",
    "sw rudd park": "sw rudd park",
    "sw strawberry vale": "sw strawberry vale",
    "sw tillicum": "sw tillicum",
    "sw west saanich": "sw west saanich"
  }
};

const normalizeArea = (listing: any, city: string) => {
  const normalizedCity = clean(city);

  const rawArea = clean(
    listing?.normalized_area ||
      listing?.address?.neighborhood ||
      listing?.address?.area ||
      listing?.area ||
      listing?.subArea ||
      listing?.neighborhood ||
      listing?.community ||
      listing?.district ||
      listing?.details?.area ||
      listing?.details?.subArea ||
      listing?.raw?.area ||
listing?.raw?.subArea ||
listing?.raw?.address?.area ||
listing?.raw?.address?.neighborhood ||
listing?.raw?.address?.community ||
listing?.raw?.details?.area ||
listing?.raw?.details?.subArea
  );

if (normalizedCity === "parksville") {
  console.log("PARKSVILLE RAW AREA DEBUG", {
    address: getNormalizedAddress(listing),
    rawArea,
    city: normalizedCity,
  });
}

  const cleanedArea = rawArea
    .replace(/^na\s+/i, "")
    .replace(/^nanaimo\s+/i, "")
    .trim();

  // 1. Building aliases first
  for (const [building, normalized] of Object.entries(BUILDING_ALIASES)) {
    if (cleanedArea === building || rawArea === building) {
      return normalized;
    }
  }

  // 2. City area aliases second
  const aliases = AREA_ALIASES[normalizedCity] || {};

for (const [needle, normalized] of Object.entries(aliases)) {
  if (cleanedArea === needle || rawArea === needle) {
    return normalized;
  }
}
const addressText = clean(
  [
    getNormalizedAddress(listing),
    listing?.address?.street,
    listing?.address?.streetName,
    listing?.address?.full,
    listing?.address?.fullAddress,
    listing?.address,
    listing?.fullAddress
  ]
    .filter(Boolean)
    .join(" ")
);

  // Street-level Nanaimo fallbacks
  if (addressText.includes("barrington rd")) {
    return "hammond bay";
  }

  if (addressText.includes("old victoria rd")) {
    return "south nanaimo";
  }
  // 3. Kill garbage areas
  if (
    !cleanedArea ||
    cleanedArea === normalizedCity ||
    cleanedArea.includes("regional district") ||
    cleanedArea.includes("city of") ||
    cleanedArea.includes(",")
  ) {
    return "unknown";
  }

// Keep the raw area if we don't have a mapping
if (cleanedArea) {
  return cleanedArea;
}

return "unknown";
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

const getSqft = (listing: any) => {
  const direct =
    listing?.sqft ||
    listing?.square_feet ||
    listing?.squareFeet ||
    listing?.details?.sqft ||
    listing?.details?.squareFeet ||
    listing?.raw?.sqft ||
    listing?.raw?.squareFeet ||
    listing?.raw?.details?.sqft ||
    listing?.raw?.details?.squareFeet;

  if (direct) {
    const cleaned = String(direct).replace(/[^0-9.]/g, "");
    return cleaned ? Number(cleaned) : null;
  }

  const description = getDescription(listing);

  const match = description.match(
    /(?:~|approx\.?|approximately)?\s*([\d,]+)\s*(?:sq\.?\s*ft\.?|sqft|square feet)/i
  );

  if (match?.[1]) {
    return Number(match[1].replace(/,/g, ""));
  }

  return null;
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
      const rawCity = clean(city);

const DUNCAN_MARKET_CITIES = new Set([
  "duncan",
  "chemainus",
  "cowichan bay",
  "cowichan station glenora",
  "crofton",
  "east duncan",
  "honeymoon bay",
  "ladysmith",
  "lake cowichan",
  "saltair",
  "west duncan",
  "youbou"
]);

const normalized_city = DUNCAN_MARKET_CITIES.has(rawCity)
  ? "duncan"
  : clean(rawCity);
      const normalized_type = normalizeType(listing);
     // Skip commercial completely
if (
  normalized_type === "commercial" ||
  normalized_type === "business"
) continue;

// TEMP DEBUG - remove after checking output
if (normalized_city === "saanich") {
  console.log("SAANICH DEBUG", {
    id,
    area: listing?.area,
    subArea: listing?.subArea,
    neighborhood: listing?.neighborhood,
    detailsArea: listing?.details?.area,
    rawArea: listing?.raw?.area,
    rawSubArea: listing?.raw?.subArea,
    rawKeys: Object.keys(listing?.raw || {}),
    detailKeys: Object.keys(listing?.details || {}),
    topKeys: Object.keys(listing || {}),
    addressKeys: Object.keys(listing?.address || {}),
    map: listing?.map,
  });
}

if (normalized_city === "colwood") {
  console.log("COLWOOD AREA DEBUG", {
    id,
    address: getNormalizedAddress(listing),
    area: listing?.area,
    subArea: listing?.subArea,
    neighborhood: listing?.neighborhood,
    rawArea: listing?.raw?.area,
    rawSubArea: listing?.raw?.subArea,
  });
}

// TEMP DEBUG - remove after checking output
if (normalized_city === "campbell river") {
  console.log("CAMPBELL AREA DEBUG", {
    id,
    address: getNormalizedAddress(listing),
    area: listing?.area,
    subArea: listing?.subArea,
    neighborhood: listing?.neighborhood,
    community: listing?.community,
    district: listing?.district,
    addressArea: listing?.address?.area,
    addressNeighborhood: listing?.address?.neighborhood,
    detailsArea: listing?.details?.area,
    detailsSubArea: listing?.details?.subArea,
    rawArea: listing?.raw?.area,
    rawSubArea: listing?.raw?.subArea,
    rawKeys: Object.keys(listing || {}),
    detailsKeys: Object.keys(listing?.details || {}),
    rawKeysNested: Object.keys(listing?.raw || {})
  });
}

let normalized_area = normalizeArea(listing, normalized_city);

if (normalized_city === "duncan" && normalized_area === "unknown") {
  const sourceCityArea = AREA_ALIASES.duncan?.[clean(listing?.source_city)];

  if (sourceCityArea) {
    normalized_area = sourceCityArea;
  }
}

const rowAddress = clean(getNormalizedAddress(listing));

if (normalized_city === "duncan" && rowAddress.includes("boys rd")) {
  normalized_area = "east duncan";
}

if (normalized_city === "nanaimo") {
  // Exact address overrides - Nanaimo cleanup
  if (rowAddress === "3365 barrington rd") {
    normalized_area = "hammond bay";
  }

  if (rowAddress === "917 old victoria rd") {
    normalized_area = "south nanaimo";
  }

  if (rowAddress.includes("fuller st")) {
  normalized_area = "central nanaimo";
}

if (rowAddress.includes("highview terr")) {
  normalized_area = "south nanaimo";
}

if (rowAddress.includes("mcgirr rd")) {
  normalized_area = "north nanaimo";
}

if (rowAddress.includes("aurora way")) {
  normalized_area = "university district";
}

if (rowAddress.includes("promenade dr")) {
  normalized_area = "old city";
}

if (rowAddress.includes("cedar grove dr")) {
  normalized_area = "north nanaimo";
}

if (rowAddress.includes("york cres")) {
  normalized_area = "diver lake";
}

if (rowAddress.includes("manzanita pl")) {
  normalized_area = "departure bay";
}

if (rowAddress.includes("4724 uplands dr")) {
  normalized_area = "uplands";
}

if (rowAddress.includes("4728 uplands dr")) {
  normalized_area = "uplands";
}

if (rowAddress.includes("riley pl")) {
  normalized_area = "north nanaimo";
}

if (rowAddress.includes("coal town way")) {
  normalized_area = "south nanaimo";
}

if (rowAddress.includes("poets trail dr")) {
  normalized_area = "university district";
}

if (rowAddress.includes("220 townsite rd")) {
  normalized_area = "brechin hill";
}

if (rowAddress.includes("kennedy st")) {
  normalized_area = "old city";
}

if (rowAddress.includes("milton st")) {
  normalized_area = "old city";
}

if (rowAddress.includes("arbour cres")) {
  normalized_area = "north nanaimo";
}

if (rowAddress.includes("linley valley dr")) {
  normalized_area = "north nanaimo";
}

if (rowAddress.includes("bradley st")) {
  normalized_area = "central nanaimo";
}

  if (rowAddress.includes("clematis pl")) {
  normalized_area = "hammond bay";
}

if (rowAddress.includes("vanderneuk rd")) {
  normalized_area = "north nanaimo";
}

if (rowAddress.includes("metral dr")) {
  normalized_area = "pleasant valley";
}

if (rowAddress.includes("doumont rd")) {
  normalized_area = "pleasant valley";
}

 if (rowAddress.includes("1633 dufferin cres")) {
  normalized_area = "central nanaimo";
}

  // Building/street-level Nanaimo overrides
if (rowAddress.includes("barons rd")) {
  normalized_area = "uplands";
}

 if (rowAddress.includes("375 newcastle ave")) {
  normalized_area = "brechin hill";
}

if (rowAddress.includes("4474 wellington rd")) {
  normalized_area = "north nanaimo";
}
}
      const images = normalizeImages(listing);

      const freshLat = getLat(listing);
      const freshLng = getLng(listing);

      const savedCoords = existingCoords.get(id);

      const lat = freshLat || savedCoords?.lat || null;
      const lng = freshLng || savedCoords?.lng || null;

      rowMap.set(id, {
        id,

                city: listing?.source_city || city,
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

sqft: getSqft(listing),

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

const rawRows = [...rowMap.values()];

// Final dedupe by normalized address
const addressMap = new Map<string, any>();

for (const row of rawRows) {
  const key = clean(row.address);

  if (!key) continue;

  const existing = addressMap.get(key);

  // First version wins
  if (!existing) {
    addressMap.set(key, row);
    continue;
  }

  // Prefer rows that actually have an MLS number
  const existingHasMls = !!existing.id;
  const rowHasMls = !!row.id;

  if (rowHasMls && !existingHasMls) {
    addressMap.set(key, row);
    continue;
  }

  // Otherwise prefer newer / larger numeric ID
  if (Number(row.id || 0) > Number(existing.id || 0)) {
    addressMap.set(key, row);
  }
}

const rows = [...addressMap.values()];
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

const BATCH = 50;

const cleanupCity = String(
  rows[0]?.normalized_city || process.argv[2] || ""
)
  .trim()
  .toLowerCase();

console.log(`Marking existing ${cleanupCity} rows inactive before rebuild...`);

const { error: preCleanError } = await supabase
  .from("listing_rows")
  .update({ status: "inactive" })
  .eq("normalized_city", cleanupCity)
  .eq("status", "A");

if (preCleanError) {
  console.error("Pre-clean failed:", preCleanError);
} else {
  console.log("Existing active rows marked inactive.");
}

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);

  const { error: upsertError } = await supabase
    .from("listing_rows")
    .upsert(batch, { onConflict: "id", ignoreDuplicates: false }); if (upsertError) {
      console.error("Batch failed:", upsertError);
      return;
    }

    console.log(`Upserted ${Math.min(i + batch.length, rows.length)} / ${rows.length}`);
  }

   const activeMlsNumbers = new Set(
  rows
    .map((row) => String(row.mls_number || row.id || "").trim())
    .filter(Boolean)
);

const { data: existingListingRows, error: staleFetchError } = await supabase
  .from("listing_rows")
  .select("mls_number")
  .eq("normalized_city", cleanupCity)
  .eq("status", "A");

if (staleFetchError) {
  console.error("Failed to fetch existing active rows:", staleFetchError);
} else {
  const staleMlsNumbers = (existingListingRows || [])
    .map((row) => String(row.mls_number || "").trim())
    .filter((mls) => mls && !activeMlsNumbers.has(mls));

  console.log("Existing active rows:", existingListingRows?.length || 0);
  console.log("Fresh active rows:", activeMlsNumbers.size);
  console.log("Stale rows to mark inactive:", staleMlsNumbers.length);
  console.log("Sample stale MLS:", staleMlsNumbers.slice(0, 10));

  for (let i = 0; i < staleMlsNumbers.length; i += 500) {
    const batch = staleMlsNumbers.slice(i, i + 500);

    const { error: staleError } = await supabase
      .from("listing_rows")
      .update({ status: "inactive" })
      .eq("normalized_city", cleanupCity)
      .in("mls_number", batch);

    if (staleError) {
      console.error("Failed to mark stale batch inactive:", staleError);
    }
  }
}
};

run();









