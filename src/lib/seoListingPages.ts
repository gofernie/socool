export type SeoListingPage = {
  slug: string;
  city: string;
  area?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price-low" | "price-high" | "beds-high";
  title: string;
  eyebrow: string;
  intro: string;
  insightsTitle: string;
  insights: string[];
  quickTake: string[];
  metaTitle: string;
  metaDescription: string;
};

const seoListingPagesRaw: SeoListingPage[] = [
  {
    slug: "nanaimo-homes-under-800k",
    city: "Nanaimo",
    maxPrice: 800,
    sort: "newest",

    eyebrow: "Nanaimo real estate",
    title: "Homes under $800k in Nanaimo",
    intro:
      "Explore Nanaimo homes currently listed under $800,000, including detached homes, townhomes, and select properties offering strong value for buyers.",

    insightsTitle: "Where the opportunities are right now",
    insights: [
      "Homes under $800k in Nanaimo tend to cluster in South Nanaimo, Central Nanaimo, and parts of the University District, where buyers can still find larger layouts compared to similarly priced options further north.",
      "In some cases, properties that have been on the market longer are presenting better value, particularly when they offer functional layouts or suite potential.",
      "Inventory in this range can move quickly when priced well, so it’s worth keeping an eye on new listings as they come to market."
    ],

    quickTake: [
      "More space available in south and central areas",
      "Older homes often offer better value",
      "Well-priced listings tend to move quickly"
    ],

    metaTitle: "Homes Under $800k in Nanaimo | Current Listings",
    metaDescription:
      "Browse Nanaimo homes under $800,000 with current listings, buyer insight, and market context."
  },
  {
    slug: "nanaimo-condos",
    city: "Nanaimo",
    type: "condo",
    sort: "price-low",

    eyebrow: "Nanaimo real estate",
    title: "Nanaimo condos for sale",
    intro:
      "Explore current Nanaimo condos, including low-maintenance homes close to shopping, trails, the waterfront, and everyday amenities.",

    insightsTitle: "What buyers should know about Nanaimo condos",
    insights: [
      "Nanaimo condos vary widely by building age, location, parking, strata fees, and outdoor space.",
      "North Nanaimo and Central Nanaimo are often popular with buyers looking for convenient access to shops, services, and main routes.",
      "Older condo buildings may offer more square footage for the money, while newer buildings often appeal to buyers looking for a simpler move-in-ready option."
    ],

    quickTake: [
      "Compare strata fees and parking carefully",
      "Older buildings may offer larger layouts",
      "Location and building condition matter as much as price"
    ],

    metaTitle: "Nanaimo Condos for Sale | Current Listings",
    metaDescription:
      "Browse Nanaimo condos for sale with current listings, buyer notes, and local market insight."
  },
  {
    slug: "nanaimo-townhouses",
    city: "Nanaimo",
    type: "townhouse",
    sort: "price-low",

    eyebrow: "Nanaimo real estate",
    title: "Nanaimo townhouses for sale",
    intro:
      "Explore current Nanaimo townhouses, including practical low-maintenance homes with more space than many condos.",

    insightsTitle: "What buyers should know about Nanaimo townhouses",
    insights: [
      "Townhouses can be a strong middle ground for buyers who want more space without taking on a full detached home.",
      "Strata fees, parking, outdoor space, and rental rules can vary significantly between townhouse complexes.",
      "Well-located townhomes near schools, shops, and commuter routes tend to attract steady buyer attention."
    ],

    quickTake: [
      "More space than many condos",
      "Compare strata fees carefully",
      "Parking and outdoor space matter"
    ],

    metaTitle: "Nanaimo Townhouses for Sale | Current Listings",
    metaDescription:
      "Browse Nanaimo townhouses for sale with current listings, buyer notes, and local market insight."
  },
  {
    slug: "nanaimo-land",
    city: "Nanaimo",
    type: "land",
    sort: "price-low",

    eyebrow: "Nanaimo real estate",
    title: "Nanaimo land for sale",
    intro:
      "Explore current Nanaimo land listings, including building lots, development opportunities, and properties with long-term potential.",

    insightsTitle: "What buyers should know about Nanaimo land",
    insights: [
      "Land value in Nanaimo depends heavily on zoning, services, slope, access, and buildability.",
      "Some lots may look affordable upfront but require additional due diligence around servicing, geotechnical conditions, and development restrictions.",
      "Well-located lots with flexible zoning or strong future-use potential can attract builders, investors, and custom-home buyers."
    ],

    quickTake: [
      "Check zoning and services first",
      "Buildability matters as much as price",
      "Strong lots need careful due diligence"
    ],

    metaTitle: "Nanaimo Land for Sale | Current Listings",
    metaDescription:
      "Browse Nanaimo land for sale with current listings, buyer notes, and local market insight."
  }
];

export const seoListingPages = seoListingPagesRaw.sort((a, b) => {
  return (
    a.city.localeCompare(b.city) ||
    (a.area || "").localeCompare(b.area || "") ||
    (a.type || "").localeCompare(b.type || "") ||
    (a.minPrice || 0) - (b.minPrice || 0) ||
    (a.maxPrice || 999999999) - (b.maxPrice || 999999999) ||
    a.title.localeCompare(b.title)
  );
});

export function getSeoListingPage(slug: string) {
  return seoListingPages.find((page) => page.slug === slug);
}