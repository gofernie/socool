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
  "rocklands at rutherford": "north nanaimo",

  // Parksville / Oceanside complexes
  "craig bay": "pq nanoose",
  "craig bay-arbutus grove": "pq nanoose",

  "fairwinds": "pq fairwinds",

  "morningstar ridge": "pq french creek",
  "morningstar": "pq french creek",
  "columbia beach": "pq french creek",

  "sunrise ridge": "pq parksville",
  "sunrise ridge resort": "pq parksville",
  "sunrise ridge resorts": "pq parksville",
  "sunrise ridge waterfront resort": "pq parksville",

  "the beach club": "pq parksville",
  "beach club": "pq parksville",
  "beach club resort": "pq parksville",
  "the beach club residences": "pq parksville",
  "residences at the beach club": "pq parksville",

  "mosaic": "pq parksville",
  "mosaic ii": "pq parksville",

  "windsor court": "pq parksville",
  "the pacific grande": "pq parksville",

   "oceanside village resort": "pq french creek",
  "ocean sands": "pq french creek",
  "ocean sands resort": "pq french creek",

  "spider lake springs resort": "pq qualicum north",
  "qualicum river estates": "pq qualicum north",
  "horne lake": "pq qualicum north",
  "horne lake community": "pq qualicum north",
  "horne lake caves road": "pq qualicum north",

  "qualicum landing": "pq qualicum beach",
  "qualicum college heights": "pq qualicum beach",
  "qualicum place": "pq qualicum beach",

  "lqrv": "pq little qualicum river village",

  "beachcomber": "pq nanoose",
  "pacific shores nature resort": "pq nanoose",
  "craig creek estates": "pq nanoose",
  "wall beach": "pq nanoose",
  "shorewater": "pq nanoose",
  "schooner house": "pq nanoose",
  "schooner ridge": "pq nanoose",
  "schooner bay manufactured home park": "pq nanoose",

  "baywater estates": "pq qualicum beach",
  "shelter ridge": "pq qualicum beach",
  "gracewood": "pq qualicum beach",
  "the westerly": "pq qualicum beach",
  "the bluffs": "pq qualicum beach",
  "eaglewood": "pq qualicum beach",
  "cameron beach": "pq qualicum beach",
  "eaglecrest": "pq qualicum beach",
  "the cedars": "pq qualicum beach",

  "wembley crossing": "pq parksville",
  "whembley crossing": "pq parksville",
  "wembley place": "pq parksville",
  "laurel park": "pq parksville",
  "riverbend townhomes": "pq parksville",
  "the meadows": "pq parksville",
  "meadows": "pq parksville",
  "parksville mobile home park": "pq parksville",
  "aurora mobile home park": "pq parksville",
  "aurora estates": "pq parksville",
  "cedarwood way": "pq parksville",

  "tanglewood": "pq parksville",
  "shellybrook park": "pq parksville",
  "emerald estates": "pq parksville",
    "tulip ave duplex": "pq parksville",

  "the willows": "pq parksville",
  "chelsea court": "pq parksville",
  "parklane place": "pq parksville",
  "the onyx": "pq parksville",
  "the 180": "pq parksville",
  "100 lombardy": "pq parksville",
  "st. andrew's lane": "pq parksville",
  "azalea terrace": "pq parksville",

  "oceanside": "pq nanoose",
  "oceanside subdivision": "pq nanoose",
  "oceanwood gardens": "pq nanoose",
  "ocean trails": "pq nanoose",
  "seaside village": "pq nanoose",
  "pebble beach": "pq nanoose",
  "bayside village": "pq nanoose",

  "rockcliffe park": "pq qualicum beach",
  "oak point estates": "pq qualicum beach",
  "parkwood place": "pq qualicum beach",
  "parkwood": "pq qualicum beach",
  "villa rose": "pq qualicum beach",
  "villa lila": "pq qualicum beach",
  "shoreline": "pq qualicum beach",
  "glen eagle": "pq qualicum beach",
  "evergreens": "pq qualicum beach",

  "river edge": "pq little qualicum river village",

    "aerie estates": "pq qualicum north",
  "chinook park": "pq qualicum north",
  "ermineskin": "pq qualicum north",
  "upland properties in dashwood": "pq qualicum north",

  "uplands": "pq qualicum beach",
  "ashleigh manor": "pq parksville",
  "ocean park gardens": "pq parksville",
  "eyres estates": "pq parksville",
  "bridgewater lane": "pq parksville",
  "avista place": "pq parksville",
  "fern tree place": "pq parksville",

  "west ridge": "pq qualicum beach",
  "coach house": "pq qualicum beach"
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
  "parksville": "pq parksville",
  "pq parksville": "pq parksville",
  "pa parksville": "pq parksville",

  "bowser/deep bay": "pq bowser/deep bay",
  "bowser deep bay": "pq bowser/deep bay",
  "pq bowser/deep bay": "pq bowser/deep bay",
  "pq bowser deep bay": "pq bowser/deep bay",
  "deep bay": "pq bowser/deep bay",
  "bowser": "pq bowser/deep bay",

  "errington/coombs/hilliers": "pq errington/coombs/hilliers",
  "errington coombs hilliers": "pq errington/coombs/hilliers",
  "pq errington/coombs/hilliers": "pq errington/coombs/hilliers",
  "pq errington coombs hilliers": "pq errington/coombs/hilliers",
  "pa errington coombs hilliers": "pq errington/coombs/hilliers",
  "errington": "pq errington/coombs/hilliers",
  "coombs": "pq errington/coombs/hilliers",
  "hilliers": "pq errington/coombs/hilliers",

  "fairwinds": "pq fairwinds",
  "pq fairwinds": "pq fairwinds",

  "french creek": "pq french creek",
  "pq french creek": "pq french creek",
  "pa french creek": "pq french creek",

  "little qualicum river village": "pq little qualicum river village",
  "pq little qualicum river village": "pq little qualicum river village",

  "nanoose": "pq nanoose",
  "nanoose bay": "pq nanoose",
  "pq nanoose": "pq nanoose",
  "pq nanoose bay": "pq nanoose",
  "pa nanoose": "pq nanoose",
  "pa nanoose bay": "pq nanoose",

 "qualicum beach": "pq qualicum beach",
"qualicum beach town of": "pq qualicum beach",
"pq qualicum beach": "pq qualicum beach",
"qb qualicum beach": "pq qualicum beach",

  "qualicum north": "pq qualicum north",
  "pq qualicum north": "pq qualicum north",
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
  .select("id, address, lat, lng, image_url, images");

  if (existingError) {
    console.error("Existing listing_rows fetch failed:", existingError);
    return;
  }

const existingRowsMap = new Map(
  (existingRows || []).map((row: any) => [
    String(row.id),
    {
      lat: numOrNull(row.lat),
      lng: numOrNull(row.lng),
      image_url: row.image_url,
      images: row.images || []
    }
  ])
);

const existingAddressImages = new Map(
  (existingRows || [])
    .filter(
      (row: any) =>
        row.address &&
        row.image_url
    )
    .map((row: any) => [
      clean(row.address),
      {
        image_url: row.image_url,
        images: row.images || []
      }
    ])
);

 const { data: boundaries } = await supabase
    .from("area_boundaries")
    .select("city, area_slug, polygon_geojson");

  function pointInPolygon(lng: number, lat: number, polygon: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

function getAreaFromPolygon(city: string, lat: number, lng: number): string | null {
    if (!lat || !lng || !boundaries) return null;
    const cityBoundaries = (boundaries as any[]).filter(b => b.city === city && b.polygon_geojson?.type === "Polygon");
    for (const b of cityBoundaries) {
      const polygon = b.polygon_geojson?.coordinates?.[0];
      if (!polygon) continue;
      if (pointInPolygon(lng, lat, polygon)) return b.area_slug;
    }
    return null;
  }

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

const PARKSVILLE_MARKET_CITIES = new Set([
  "parksville",
  "nanoose bay",
  "qualicum beach"
]);

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

const normalized_city =
  PARKSVILLE_MARKET_CITIES.has(rawCity)
    ? "parksville"
    : DUNCAN_MARKET_CITIES.has(rawCity)
      ? "duncan"
      : clean(rawCity);
      const normalized_type = normalizeType(listing);
      // Fernie/Sparwood: unit-prefixed addresses (e.g. "613D 4559" or "2221 5350") are condos
      const rowAddressForType = clean(getNormalizedAddress(listing));
      const finalType = (normalized_city === "fernie" || normalized_city === "sparwood") && /^[a-z0-9]+ \d{3,}/i.test(rowAddressForType)
        ? "condo"
        : normalized_type;
     // Skip commercial completely
if (
  normalized_type === "commercial" ||
  normalized_type === "business"
) continue;







let normalized_area = normalizeArea(listing, normalized_city);

// Polygon fallback for unknown areas
if (normalized_area === "unknown" || !normalized_area) {
  const freshLat = getLat(listing);
  const freshLng = getLng(listing);
  const polygonArea = freshLat && freshLng ? getAreaFromPolygon(normalized_city, freshLat, freshLng) : null;
  if (polygonArea) normalized_area = polygonArea;
}

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
      const images = normalizeImages(listing).map((url) => {
  const cleaned = url.startsWith("/") ? url : `/${url.replace(/^https?:\/\/[^/]+/, "")}`;
  return `https://cdn.repliers.io${cleaned}`;
});

      const freshLat = getLat(listing);
      const freshLng = getLng(listing);

     const existingRow = existingRowsMap.get(id);

const lat = freshLat || existingRow?.lat || null;
const lng = freshLng || existingRow?.lng || null;

const addressKey = clean(getNormalizedAddress(listing));

const fallbackImages =
  existingAddressImages.get(addressKey);

const finalImages =
  images.length > 0
    ? images
    : fallbackImages?.images || [];

const finalImageUrl =
  finalImages[0] ||
  fallbackImages?.image_url ||
  null;

     rowMap.set(id, {
  id,
  mls_number: id,

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
       normalized_type: finalType,

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

waterfront:
  ["y", "yes", "true", "ocean", "lake", "river", "creek"].some((term) =>
    String(
      listing?.details?.waterfront ||
        listing?.raw?.details?.waterfront ||
        listing?.details?.waterfrontType ||
        listing?.raw?.details?.waterfrontType ||
        ""
    )
      .toLowerCase()
      .includes(term)
  ),

waterfront_type: (() => {
  const isWaterfront = Boolean(
    listing?.details?.waterfront ||
      listing?.raw?.details?.waterfront ||
      listing?.waterfront
  );

  if (!isWaterfront) return null;

  const viewSource = String(
    listing?.details?.viewType ||
      listing?.raw?.details?.viewType ||
      listing?.view_type ||
      ""
  ).toLowerCase();

  if (viewSource.includes("river")) return "riverfront";
  if (viewSource.includes("lake")) return "lakefront";
  if (viewSource.includes("ocean")) return "oceanfront";

  return "waterfront";
})(),

ocean_view:
  String(
    listing?.details?.viewType ||
    listing?.raw?.details?.viewType ||
    ""
  )
    .toLowerCase()
    .includes("ocean"),

view_type:
  listing?.details?.viewType ||
  listing?.raw?.details?.viewType ||
  null,

status: "A",

image_url: finalImageUrl,
images: finalImages,

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
const uniqueRows = Array.from(
  new Map(rows.map((row) => [row.id, row])).values()
);

console.log("Rows after dedupe:", uniqueRows.length);
console.log("SAMPLE ROW");
console.dir(rows[0], { depth: null });

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

for (let i = 0; i < uniqueRows.length; i += BATCH) {
  const batch = uniqueRows.slice(i, i + BATCH);

 const { error: upsertError } = await supabase
  .from("listing_rows")
.upsert(batch, { onConflict: "id", ignoreDuplicates: false });
if (upsertError) {
  console.error("Batch failed:", upsertError);
  return;
}

console.log(
  `Upserted ${Math.min(i + batch.length, uniqueRows.length)} / ${uniqueRows.length}`
);
}

console.log("Done.");
}

run();