// On-device ingredient matching against the user's allergies and goals.
// Nothing here talks to a server; allergies and goals never leave the device.

export interface Flag {
  ingredient: string;
  kind: "allergy" | "goal";
  label: string; // the allergy or goal it clashes with
  reason: string;
  mayContain?: boolean;
}

export interface CheckResult {
  ingredients: string[];
  flags: Flag[];
  safe: string[];
  verdict: "bad" | "caution" | "good";
  summary: string;
}

type Term = string | { t: string; not: RegExp };

interface Rule {
  terms: Term[];
  /** Short note used when the match is a derived ingredient (e.g. soy lecithin). */
  derived?: Record<string, string>;
}

// Common allergens and the names they hide under on ingredient lists.
export const ALLERGENS: Record<string, Rule> = {
  Peanuts: { terms: ["peanut", "groundnut", "arachis", "monkey nut"], derived: { arachis: "Arachis oil is peanut oil." } },
  "Tree nuts": {
    terms: ["almond", "hazelnut", "walnut", "cashew", "pecan", "pistachio", "macadamia", "brazil nut", "praline", "marzipan", "nut"],
    derived: { marzipan: "Marzipan is made from almonds.", praline: "Praline is usually made from nuts." },
  },
  Milk: {
    terms: [
      { t: "milk", not: /(coconut|almond|oat|soy|soya|rice|cashew)\s+milk/ }, "whey", "casein", "caseinate", "lactose",
      { t: "butter", not: /(cocoa|shea|peanut|nut|almond|apple|cashew)\s+butter|butternut/ }, { t: "cream", not: /cream of tartar/ },
      "cheese", "ghee", "yogurt", "yoghurt", "lactalbumin", "milk solids", "curd",
    ],
    derived: { whey: "Whey comes from milk.", casein: "Casein is a milk protein.", caseinate: "Caseinate is a milk protein.", lactose: "Lactose is milk sugar.", ghee: "Ghee is made from butter." },
  },
  Eggs: { terms: ["egg", "albumin", "ovalbumin", "lysozyme", "mayonnaise", "meringue"], derived: { albumin: "Albumin usually comes from egg white.", lysozyme: "Lysozyme often comes from egg.", mayonnaise: "Mayonnaise is made with egg." } },
  Soy: {
    terms: ["soy", "soya", "soybean", "lecithin", "tofu", "edamame", "miso", "tempeh", "tamari", "shoyu", "textured vegetable protein"],
    derived: { lecithin: "Lecithin is often made from soy. Check the pack if it does not say which kind.", tamari: "Tamari is a soy sauce.", miso: "Miso is made from soybeans.", tofu: "Tofu is made from soybeans." },
  },
  "Wheat / gluten": {
    terms: ["wheat", "gluten", "barley", "rye", "spelt", "malt", "semolina", "durum", "couscous", "bulgur", "seitan", "triticale", "farina", "oat"],
    derived: { malt: "Malt is usually made from barley, which has gluten.", semolina: "Semolina is made from wheat.", oat: "Oats are often processed with wheat unless marked gluten-free.", couscous: "Couscous is made from wheat." },
  },
  Fish: { terms: ["fish", "anchovy", "anchovies", "cod", "salmon", "tuna", "sardine", "worcestershire"], derived: { worcestershire: "Worcestershire sauce usually contains anchovies." } },
  Shellfish: { terms: ["shrimp", "prawn", "crab", "lobster", "crayfish", "krill", "scampi", "crustacean", "mussel", "oyster", "clam", "squid"] },
  Sesame: { terms: ["sesame", "tahini", "gingelly", "benne"], derived: { tahini: "Tahini is made from sesame seeds." } },
  Mustard: { terms: ["mustard"] },
  Celery: { terms: ["celery", "celeriac"] },
  Sulphites: {
    terms: ["sulphite", "sulfite", "sulphur dioxide", "sulfur dioxide", "metabisulphite", "metabisulfite", "e220", "e221", "e222", "e223", "e224", "e228"],
  },
  Lupin: { terms: ["lupin", "lupine"] },
  Corn: { terms: ["corn", "maize", "cornstarch", "dextrose", "maltodextrin"], derived: { dextrose: "Dextrose is often made from corn.", maltodextrin: "Maltodextrin is often made from corn." } },
};

const SUGARS = [
  "sugar", "cane sugar", "glucose", "fructose", "sucrose", "dextrose", "corn syrup", "rice syrup", "honey", "maltose",
  "molasses", "agave", "invert sugar", "syrup", "caramel", "treacle", "fruit juice concentrate",
];
const MEAT = ["beef", "pork", "chicken", "lamb", "bacon", "ham", "gelatin", "gelatine", "lard", "tallow", "rennet", "carmine", "cochineal", "anchovy", "fish"];
const DAIRY = ALLERGENS.Milk.terms;

export const GOALS: Record<string, Rule & { describe: string }> = {
  "Low sugar": { terms: SUGARS, describe: "You want low sugar." },
  "Low salt": { terms: ["salt", "sea salt", "sodium", "monosodium glutamate", "baking soda", "soy sauce", "brine"], describe: "You want low salt." },
  "Low fat": { terms: ["palm oil", "palm fat", "hydrogenated", "shortening", "lard", "butter", "cream", "vegetable fat", "coconut oil"], describe: "You want low fat." },
  Vegan: { terms: [...DAIRY, "egg", "honey", "beeswax", "shellac", "lanolin", ...MEAT], describe: "You eat vegan." },
  Vegetarian: { terms: MEAT, describe: "You eat vegetarian." },
  "Gluten-free": { terms: ALLERGENS["Wheat / gluten"].terms, derived: ALLERGENS["Wheat / gluten"].derived, describe: "You eat gluten-free." },
  "Dairy-free": { terms: DAIRY, derived: ALLERGENS.Milk.derived, describe: "You eat dairy-free." },
  "No caffeine": { terms: ["caffeine", "coffee", "guarana", "green tea extract", "kola", "cola nut", "yerba mate"], describe: "You avoid caffeine." },
  "No alcohol": { terms: ["alcohol", "ethanol", "wine", "rum", "brandy", "liqueur", "beer", "whisky"], describe: "You avoid alcohol." },
  "No artificial sweeteners": { terms: ["aspartame", "sucralose", "saccharin", "acesulfame", "cyclamate", "neotame"], describe: "You avoid artificial sweeteners." },
  Halal: { terms: ["pork", "bacon", "ham", "lard", "gelatin", "gelatine", "alcohol", "wine", "rum", "carmine"], describe: "You eat halal." },
};

// Open Food Facts allergen tags -> our allergen names (used with barcode lookups).
export const OFF_ALLERGENS: Record<string, string> = {
  "en:peanuts": "Peanuts", "en:nuts": "Tree nuts", "en:milk": "Milk", "en:eggs": "Eggs", "en:soybeans": "Soy",
  "en:gluten": "Wheat / gluten", "en:fish": "Fish", "en:crustaceans": "Shellfish", "en:molluscs": "Shellfish",
  "en:sesame-seeds": "Sesame", "en:mustard": "Mustard", "en:celery": "Celery", "en:sulphur-dioxide-and-sulphites": "Sulphites", "en:lupin": "Lupin",
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matchTerm(text: string, term: Term): string | null {
  const t = typeof term === "string" ? term : term.t;
  const re = new RegExp(`\\b${escape(t)}(e?s)?\\b`, "i");
  if (!re.test(text)) return null;
  if (typeof term !== "string" && term.not.test(text)) {
    // e.g. "cocoa butter" is not dairy; only flag if the term also appears on its own.
    const stripped = text.replace(new RegExp(term.not.source, "gi"), " ");
    if (!re.test(stripped)) return null;
  }
  return t;
}

function ruleMatch(text: string, rule: Rule): string | null {
  for (const term of rule.terms) {
    const hit = matchTerm(text, term);
    if (hit) return hit;
  }
  return null;
}

/** Splits an ingredient list at top-level commas, keeping "(...)" sub-ingredients together. */
export function splitIngredients(raw: string): { items: string[]; mayContain: string } {
  let text = raw.replace(/\s+/g, " ").replace(/^ingredients?\s*[:.-]?\s*/i, "").trim();
  let mayContain = "";
  const mc = text.match(/(may contain|may also contain|made in a factory that (also )?handles|traces? of)[^.]*\.?/i);
  if (mc) {
    mayContain = mc[0];
    text = text.replace(mc[0], " ");
  }
  const items: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      items.push(cur);
      cur = "";
    } else cur += ch;
  }
  items.push(cur);
  return {
    items: items.map((i) => i.replace(/^(contains|ingredients)\s*:?/i, "").replace(/[.\s]+$/, "").trim()).filter((i) => i.length > 1),
    mayContain,
  };
}

function ordinal(n: number) {
  return ["first", "second", "third"][n] ?? `number ${n + 1}`;
}

export function checkIngredients(
  raw: string,
  profile: { allergies: string[]; goals: string[] },
  extra?: { allergenTags?: string[]; traceTags?: string[]; sugars100g?: number; salt100g?: number; fat100g?: number },
): CheckResult {
  const { items, mayContain } = splitIngredients(raw);
  const flags: Flag[] = [];
  const flagged = new Set<number>();

  items.forEach((item, idx) => {
    for (const allergy of profile.allergies) {
      const rule = ALLERGENS[allergy] ?? { terms: [allergy.toLowerCase()] };
      const hit = ruleMatch(item, rule);
      if (hit) {
        const derived = rule.derived?.[hit];
        const a = allergy.toLowerCase();
        const base = item.toLowerCase().replace(/\(.*\)/, "").trim();
        const exact = base === hit || base === `${hit}s` || base === `${hit}es`;
        const listed = a.startsWith(hit) ? `${hit}, which you listed as an allergy` : `${hit}. You listed ${a} as an allergy`;
        flags.push({
          ingredient: item,
          kind: "allergy",
          label: allergy,
          reason: exact
            ? `You listed ${a} as an allergy. Avoid this product.`
            : derived
              ? `${derived} You listed ${a} as an allergy.`
              : base.startsWith(hit)
                ? `This comes from ${listed}.`
                : `This contains ${listed}.`,
        });
        flagged.add(idx);
      }
    }
    for (const goal of profile.goals) {
      const rule = GOALS[goal];
      if (!rule) continue;
      const hit = ruleMatch(item, rule);
      if (hit) {
        const position = idx < 3 ? ` It is listed ${ordinal(idx)}, so there is a lot of it.` : "";
        const derived = rule.derived?.[hit];
        flags.push({ ingredient: item, kind: "goal", label: goal, reason: `${derived ? derived + " " : ""}${rule.describe}${position}` });
        flagged.add(idx);
      }
    }
  });

  // "May contain" warnings and barcode allergen tags
  const traceText = mayContain.toLowerCase();
  const tagged = new Set((extra?.allergenTags ?? []).map((t) => OFF_ALLERGENS[t]).filter(Boolean));
  const traces = new Set((extra?.traceTags ?? []).map((t) => OFF_ALLERGENS[t]).filter(Boolean));
  for (const allergy of profile.allergies) {
    const already = flags.some((f) => f.kind === "allergy" && f.label === allergy);
    if (already) continue;
    const rule = ALLERGENS[allergy] ?? { terms: [allergy.toLowerCase()] };
    if (tagged.has(allergy)) {
      flags.push({ ingredient: allergy, kind: "allergy", label: allergy, reason: `The product's allergen list says it contains ${allergy.toLowerCase()}, which you listed as an allergy.` });
    } else if ((traceText && ruleMatch(traceText, rule)) || traces.has(allergy)) {
      flags.push({ ingredient: `May contain ${allergy.toLowerCase()}`, kind: "allergy", label: allergy, mayContain: true, reason: `The pack warns it may contain traces of ${allergy.toLowerCase()}. Ask your doctor if traces are a risk for you.` });
    }
  }

  // Nutrition-based goals (UK traffic-light "high" levels per 100 g), when the barcode data has them.
  const nutrition: [string, number | undefined, number, string][] = [
    ["Low sugar", extra?.sugars100g, 22.5, "sugar"],
    ["Low salt", extra?.salt100g, 1.5, "salt"],
    ["Low fat", extra?.fat100g, 17.5, "fat"],
  ];
  for (const [goal, value, high, word] of nutrition) {
    if (profile.goals.includes(goal) && typeof value === "number" && value > high) {
      flags.push({ ingredient: `High in ${word}`, kind: "goal", label: goal, reason: `It has ${value} g of ${word} per 100 g, which counts as high. ${GOALS[goal].describe}` });
    }
  }

  const allergyFlags = flags.filter((f) => f.kind === "allergy" && !f.mayContain);
  const goalFlags = flags.filter((f) => f.kind === "goal");
  const verdict: CheckResult["verdict"] = allergyFlags.length ? "bad" : flags.length ? "caution" : "good";

  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");
  const allergyNames = [...new Set(allergyFlags.map((f) => f.label.toLowerCase()))];
  const goalNames = [...new Set(goalFlags.map((f) => f.label.toLowerCase()))];
  let summary: string;
  if (verdict === "bad") {
    summary = `It contains ${list(allergyNames)}, which you listed as ${allergyNames.length > 1 ? "allergies" : "an allergy"}.`;
    if (goalNames.length) summary += ` It also does not fit your goal${goalNames.length > 1 ? "s" : ""}: ${list(goalNames)}.`;
  } else if (verdict === "caution") {
    summary = goalNames.length
      ? `No listed allergens found, but it does not fit your goal${goalNames.length > 1 ? "s" : ""}: ${list(goalNames)}.`
      : "No listed allergens found, but the pack has a \"may contain\" warning that matches your allergies.";
  } else {
    summary = profile.allergies.length || profile.goals.length
      ? "We did not find any ingredients that clash with your allergies or goals. Always read the pack too."
      : "Add your allergies and goals in Settings so MedLens knows what to look for.";
  }

  return { ingredients: items, flags, safe: items.filter((_, i) => !flagged.has(i)), verdict, summary };
}
