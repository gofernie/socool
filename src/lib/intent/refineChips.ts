type RefineChip = {
  label: string;
  refine_label: string;
  kind: "area" | "feature" | "similar";
  score: number;
};

type BehaviourListing = {
  address?: string | null;
  area?: string | null;
  normalized_area?: string | null;
  description?: string | null;
  decision?: string | null;
  liked_tags?: string[] | null;
};

const FEATURE_RULES = [
  {
    key: "updated-interiors",
    label: "More updated interiors",
    words: ["updated", "renovated", "modern", "new kitchen", "new flooring", "turnkey", "move-in"],
  },
  {
    key: "fenced-yards",
    label: "More fenced yards",
    words: ["fenced", "fully fenced", "yard", "backyard"],
  },
  {
    key: "garage-space",
    label: "More garage space",
    words: ["garage", "double garage", "detached garage", "shop", "workshop"],
  },
  {
    key: "larger-yards",
    label: "Larger yards",
    words: ["large lot", "big yard", "spacious yard", "private yard", "outdoor space"],
  },
  {
    key: "income-suite",
    label: "More suite potential",
    words: ["suite", "in-law", "mortgage helper", "secondary suite", "basement suite"],
  },
  {
    key: "views",
    label: "More views",
    words: ["view", "views", "ocean", "water view", "mountain view"],
  },
  {
    key: "better-layout",
    label: "Better layout",
    words: ["layout", "open concept", "floor plan", "flow", "vaulted ceilings"],
  },
];

function clean(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function niceArea(area: string) {
  return area
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeLikedTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((t) => String(t || "").toLowerCase());
  }

  try {
    const parsed = JSON.parse(String(value || "[]"));

    if (Array.isArray(parsed)) {
      return parsed.map((t) => String(t || "").toLowerCase());
    }
  } catch {
    // ignore bad json
  }

  return [];
}

export function generateBehaviourRefineChips(
  listings: BehaviourListing[]
): RefineChip[] {
  const scores = new Map<string, RefineChip>();

  function addChip(chip: RefineChip) {
    const existing = scores.get(chip.refine_label);

    if (existing) {
      existing.score += chip.score;
    } else {
      scores.set(chip.refine_label, chip);
    }
  }

  const positiveListings = listings.filter((item) => {
    const decision = clean(item.decision);
    return decision === "love" || decision === "maybe" || decision === "favourite";
  });

  for (const item of positiveListings) {
    const decision = clean(item.decision);
    const weight = decision === "love" || decision === "favourite" ? 5 : 2;

    const tags = normalizeLikedTags(item.liked_tags);

    const text = `
      ${item.description || ""}
      ${tags.join(" ")}
    `.toLowerCase();

    const area = clean(item.normalized_area || item.area);

    if (area && area !== "unknown") {
      addChip({
        label: `Stay in ${niceArea(area)}`,
        refine_label: `stay-in-${area.replace(/\s+/g, "-")}`,
        kind: "area",
        score: weight + 2,
      });
    }

    for (const rule of FEATURE_RULES) {
      if (rule.words.some((word) => text.includes(word))) {
        addChip({
          label: rule.label,
          refine_label: rule.key,
          kind: "feature",
          score: weight,
        });
      }
    }

    const address = String(item.address || "").trim();

    if (address && decision === "love") {
      const shortAddress = address.split(",")[0];

      addChip({
        label: `More homes like ${shortAddress}`,
        refine_label: `similar-to-${shortAddress
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}`,
        kind: "similar",
        score: weight + 4,
      });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}