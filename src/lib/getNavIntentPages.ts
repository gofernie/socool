export async function getNavIntentPages(supabase: any, city: string) {
  const { data, error } = await supabase
    .from("intent_pages")
    .select("slug, nav_label, hero_heading, seo_heading, lifestyle_angle, property_type, sort_order, show_in_nav")
    .eq("city", city)
    .eq("is_published", true)
    .eq("show_in_nav", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Nav intent pages error:", error);
    return [];
  }

  return data || [];
}