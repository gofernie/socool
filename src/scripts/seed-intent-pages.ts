import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env"
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

type SeedIntentPage = {
  slug: string;
  city: string;
  area?: string | null;
  property_type: string;
  lifestyle_angle: string;
  price_min?: number | null;
  price_max?: number | null;
  seo_title: string;
  hero_heading: string;
  intro_copy: string;
  features: string[];
};

const pages: SeedIntentPage[] = [
  {
    slug: "family-homes-under-800k",
    city: "nanaimo",
    property_type: "house",
    lifestyle_angle: "family",
    price_max: 800000,
    seo_title: "Nanaimo Family Homes Under $800K",
    hero_heading: "Family Homes in Nanaimo Under $800K",
    intro_copy:
      "Explore Nanaimo homes that may work well for families, with practical layouts, usable space, and a price point under $800K.",
    features: ["family"],
  },
  {
    slug: "family-homes-with-yards",
    city: "nanaimo",
    property_type: "house",
    lifestyle_angle: "family",
    seo_title: "Nanaimo Family Homes With Yards",
    hero_heading: "Family Homes With Yards in Nanaimo",
    intro_copy:
      "Browse Nanaimo homes with outdoor space, yards, and family-friendly potential.",
    features: ["family", "yard"],
  },
  {
    slug: "family-homes-with-garages",
    city: "nanaimo",
    property_type: "house",
    lifestyle_angle: "family",
    seo_title: "Nanaimo Family Homes With Garages",
    hero_heading: "Family Homes With Garages in Nanaimo",
    intro_copy:
      "Find Nanaimo homes with garage space, storage potential, and practical family layouts.",
    features: ["family", "garage"],
  },
  {
    slug: "updated-family-homes",
    city: "nanaimo",
    property_type: "house",
    lifestyle_angle: "family",
    seo_title: "Updated Family Homes in Nanaimo",
    hero_heading: "Updated Family Homes in Nanaimo",
    intro_copy:
      "Explore Nanaimo family homes with updated finishes, modern layouts, and move-in-ready appeal.",
    features: ["family", "updated"],
  },
  {
    slug: "investment-properties-with-suites",
    city: "nanaimo",
    property_type: "house",
    lifestyle_angle: "investment",
    seo_title: "Nanaimo Investment Properties With Suites",
    hero_heading: "Investment Properties With Suites in Nanaimo",
    intro_copy:
      "Browse Nanaimo homes with suite potential, rental flexibility, or income-producing possibilities.",
    features: ["investment", "suite"],
  },
  {
    slug: "walkable-condos",
    city: "nanaimo",
    property_type: "condo",
    lifestyle_angle: "walkable",
    seo_title: "Walkable Condos in Nanaimo",
    hero_heading: "Walkable Condos in Nanaimo",
    intro_copy:
      "Explore Nanaimo condos close to amenities, services, parks, and daily conveniences.",
    features: ["walkable", "low_maintenance"],
  },
  {
    slug: "downsizer-condos",
    city: "nanaimo",
    property_type: "condo",
    lifestyle_angle: "downsizer",
    seo_title: "Nanaimo Condos for Downsizers",
    hero_heading: "Nanaimo Condos for Downsizers",
    intro_copy:
      "Browse lower-maintenance Nanaimo condos that may appeal to downsizers looking for comfort, convenience, and simplicity.",
    features: ["downsizer", "low_maintenance"],
  },
  {
    slug: "ocean-view-condos",
    city: "nanaimo",
    property_type: "condo",
    lifestyle_angle: "ocean_view",
    seo_title: "Ocean View Condos in Nanaimo",
    hero_heading: "Ocean View Condos in Nanaimo",
    intro_copy:
      "Explore Nanaimo condos with ocean view potential, coastal appeal, and low-maintenance living.",
    features: ["views", "low_maintenance"],
  },
];

async function main() {
  console.log(`Seeding ${pages.length} Nanaimo intent pages...`);

  for (const page of pages) {
    const { features, ...pageRow } = page;

    const { data: intentPage, error: pageError } = await supabase
      .from("intent_pages")
      .upsert(
        {
          ...pageRow,
          status: "published",
          is_indexed: true,
          cta_style: "shortlist",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("id, slug")
      .single();

    if (pageError || !intentPage) {
      console.error("Failed page:", page.slug, pageError);
      continue;
    }

    await supabase
      .from("intent_page_features")
      .delete()
      .eq("intent_page_id", intentPage.id);

    const featureRows = features.map((feature_key) => ({
      intent_page_id: intentPage.id,
      feature_key,
    }));

    const { error: featureError } = await supabase
      .from("intent_page_features")
      .insert(featureRows);

    if (featureError) {
      console.error("Failed features:", page.slug, featureError);
      continue;
    }

    console.log(`Seeded: ${intentPage.slug}`);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});