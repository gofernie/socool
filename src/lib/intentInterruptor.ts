export function getInterruptorContent(intentPage: any) {
  const slug = (intentPage?.slug || "").toLowerCase();
  const lifestyle = (intentPage?.lifestyle_angle || "").toLowerCase();

  // Oceanfront
  if (slug.includes("oceanfront") || slug.includes("waterfront")) {
    return {
      title: "Still looking for the right stretch of waterfront?",
      description:
        "You've viewed a few waterfront properties. What matters most about the waterfront experience?",
      features: [
        "Walk-on waterfront",
        "Sandy beach",
        "Deep water",
        "Sunset views",
        "Privacy",
        "Protected bay",
      ],
    };
  }

  // Ocean view
  if (slug.includes("ocean-view") || slug.includes("view")) {
    return {
      title: "What's most important about the view?",
      description:
        "Tell us what kind of view property you'd like to see more of.",
      features: [
        "Panoramic views",
        "Sunset views",
        "Modern interior",
        "Large lot",
        "Suite potential",
        "Privacy",
      ],
    };
  }

  // Family
  if (
    slug.includes("family") ||
    lifestyle.includes("family")
  ) {
    return {
      title: "What would make the next homes a better fit?",
      description:
        "Help us narrow in on the homes your family is most likely to love.",
      features: [
        "Larger yard",
        "More bedrooms",
        "Garage space",
        "Better schools",
        "Newer construction",
        "Suite potential",
      ],
    };
  }

  // Condo
  if (
    slug.includes("condo") ||
    intentPage?.property_type === "condo"
  ) {
    return {
      title: "Let's refine your condo search.",
      description:
        "What matters most in your ideal condo?",
      features: [
        "Walkable location",
        "Ocean views",
        "Luxury finishes",
        "Low strata fees",
        "Newer building",
        "Best value",
      ],
    };
  }

  // Downsizer
  if (
    slug.includes("downsizer") ||
    lifestyle.includes("downsizer")
  ) {
    return {
      title: "What matters most in your next chapter?",
      description:
        "Help us find homes that better match your lifestyle.",
      features: [
        "One-level living",
        "Low maintenance",
        "Walkable amenities",
        "Ocean views",
        "Smaller yard",
        "Newer home",
      ],
    };
  }

  return {
    title: "Want to steer the next few matches?",
    description:
      "Pick a direction to guide what shows up next.",
    features: [
      "Views",
      "Better layout",
      "Larger yard",
      "Garage space",
      "Walkability",
      "Best value",
    ],
  };
}