// Pipeline after the user confirms a medicine:
// Nigeria: NAFDAC Greenbook product -> its approved SmPC (PDF). US, or no SmPC: RxNorm -> openFDA -> DailyMed.
// Then a plain-language rewrite. The model only ever receives the fetched official text; nothing comes from memory.

import type { Country, LabelResponse, MedQuery, MedResult, NafdacProduct, SideEffectLevel } from "../types";
import { generateJson, llmAvailable, LlmUnavailableError, NOT_FOUND, rewritePrompt, rewriteSchema } from "./llm";
import { getNafdacProduct, ingredientList, smpcSections } from "./nafdac";

type SectionKey =
  | "purpose" | "indications" | "dosage" | "boxedWarning" | "warnings" | "doNotUse" | "askDoctor" | "whenUsing"
  | "stopUse" | "contraindications" | "adverseReactions" | "interactions" | "overdose" | "pregnancy" | "patientInfo";
export type Sections = Partial<Record<SectionKey, string>>;

interface FoundLabel {
  sections: Sections;
  matchedName: string;
  genericNames: string[];
  brandNames: string[];
  pharmClasses: string[];
  source: MedResult["source"];
}

const SECTION_TITLES: Record<SectionKey, string> = {
  purpose: "Purpose", indications: "Uses / indications", dosage: "Directions / dosage", boxedWarning: "Boxed warning",
  warnings: "Warnings", doNotUse: "Do not use", askDoctor: "Ask a doctor or pharmacist before use", whenUsing: "When using this product",
  stopUse: "Stop use and ask a doctor if", contraindications: "Contraindications", adverseReactions: "Adverse reactions",
  interactions: "Drug interactions", overdose: "Overdosage", pregnancy: "Pregnancy or breast-feeding", patientInfo: "Patient information",
};

// openFDA field names for each section
const FDA_FIELDS: Record<SectionKey, string[]> = {
  purpose: ["purpose"], indications: ["indications_and_usage"], dosage: ["dosage_and_administration"],
  boxedWarning: ["boxed_warning"], warnings: ["warnings", "warnings_and_cautions", "precautions", "general_precautions"],
  doNotUse: ["do_not_use"], askDoctor: ["ask_doctor", "ask_doctor_or_pharmacist"], whenUsing: ["when_using"],
  stopUse: ["stop_use"], contraindications: ["contraindications"], adverseReactions: ["adverse_reactions"],
  interactions: ["drug_interactions"], overdose: ["overdosage"], pregnancy: ["pregnancy_or_breast_feeding", "pregnancy"],
  patientInfo: ["information_for_patients", "spl_patient_package_insert", "patient_medication_information"],
};

// LOINC section codes used in DailyMed SPL documents
const SPL_CODES: Record<string, SectionKey> = {
  "55105-1": "purpose", "34067-9": "indications", "34068-7": "dosage", "34066-1": "boxedWarning", "34071-1": "warnings",
  "43685-7": "warnings", "42232-9": "warnings", "50570-1": "doNotUse", "50569-3": "askDoctor", "50568-5": "askDoctor",
  "50567-7": "whenUsing", "50566-9": "stopUse", "34070-3": "contraindications", "34084-4": "adverseReactions",
  "34073-7": "interactions", "34088-5": "overdose", "53414-9": "pregnancy", "42231-1": "patientInfo", "34076-0": "patientInfo",
};

// International names that US labels file under a different name.
const INTL_NAMES: Record<string, string> = {
  paracetamol: "acetaminophen", salbutamol: "albuterol", adrenaline: "epinephrine", noradrenaline: "norepinephrine",
  glibenclamide: "glyburide", frusemide: "furosemide", lignocaine: "lidocaine", amoxycillin: "amoxicillin",
  rifampicin: "rifampin", ciclosporin: "cyclosporine", colecalciferol: "cholecalciferol", hyoscine: "scopolamine",
  pethidine: "meperidine", "co-trimoxazole": "sulfamethoxazole and trimethoprim", levothyroxine: "levothyroxine",
};

const LANGUAGES: Record<string, string> = { en: "English", es: "Spanish", fr: "French" };

// ---------------- helpers ----------------

async function getJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: 86400 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return (await res.json()) as T;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function cap(s: string, n: number) {
  return s.length > n ? s.slice(0, n).replace(/\s\S*$/, "") + " …" : s;
}

function toUsName(name: string) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => INTL_NAMES[w] ?? w)
    .join(" ");
}

function stripHeading(s: string) {
  return s
    .replace(/^(uses|use|directions|purpose|purposes|warnings|indications|other information)\b[:\s]*/i, "")
    .replace(/^\d+(\.\d+)?\s+[A-Z][A-Z &/,-]{3,}\s+/, "")
    .trim();
}

const HEADING_ONLY =
  /^(stop use and( ask( a)? doctor( if)?)?|ask a doctor( or pharmacist)?( before use)?( if( you( have| are)?)?)?|do not use|when using this product|directions|warnings|uses)[:.]?$/i;

// Boilerplate that means nothing to a patient.
const JUNK =
  /to report suspected adverse|clinical (trials|studies) (are|experience)|discussed (in more detail )?(below|elsewhere|in (other|greater))|described below and elsewhere|^table \d|tables? \d+ (and \d+ )?(include|present|shows?|lists?)|consult the labeling|refer to (the )?full prescribing|^see (full|section)|www\.fda\.gov\/medwatch/i;

/** Prescription sections repeat a short summary before "2.1 ..." subsections; keep just the summary. */
function summaryPart(text: string) {
  const m = text.slice(60).search(/\s\d{1,2}\.\d{1,2}\s+[A-Z]/);
  return m === -1 ? text : text.slice(0, m + 60);
}

/** Splits label text into bullet-sized items. */
function items(text: string | undefined, max: number, maxLen = 260): string[] {
  if (!text) return [];
  const parts = summaryPart(stripHeading(text))
    .replace(/\(\s*\d+(\.\d+)?(\s*,\s*\d+(\.\d+)?)*\s*\)/g, "") // "(2.1, 2.2)" cross references
    .replace(/\[\s*see [^\]]*\]/gi, "")
    .split(/\s*[•■●▪◦]\s*|(?<=[.;])\s+(?=[A-Z(])|\s(?=[A-Z][A-Za-z ]{2,40} (?:alert|warning):)/)
    // OTC labels often lose their bullets; split before typical bullet openings instead.
    .flatMap((p) =>
      p.length > 120 && !/\.\s/.test(p)
        ? p.split(/\s(?=(?:do not|ask a doctor|stop use|when using|keep out|use only|swallow)\b)|(?<!\b(?:and|or|for|of))\s(?=(?:adults|children)\b)/i)
        : [p],
    )
    .map(clean)
    .filter((p) => p.length > 3 && !HEADING_ONLY.test(p) && !JUNK.test(p));
  // Re-join items that were cut mid-sentence ("indicated for the:" + "treatment of ...").
  const joined: string[] = [];
  for (const p of parts) {
    const prev = joined[joined.length - 1];
    if (prev && (/:$/.test(prev) || /\b(in|the|for|of|to|and|with|or|are|is|include|including)$/i.test(prev))) joined[joined.length - 1] = `${prev} ${p.charAt(0).toLowerCase()}${p.slice(1)}`;
    else joined.push(p);
  }
  return [...new Set(joined)].slice(0, max).map((p) => cap(p.charAt(0).toUpperCase() + p.slice(1), maxLen));
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

// ---------------- RxNorm ----------------

interface RxMatch {
  rxcui: string;
  name: string;
  tty: string;
  ingredients: string[];
  brands: string[];
}

async function rxnormNormalize(q: MedQuery): Promise<RxMatch | null> {
  const name = toUsName(q.name);
  const term = clean(`${name} ${q.strength} ${q.form}`);
  try {
    type Approx = { approximateGroup?: { candidate?: { rxcui: string }[] } };
    const approx = await getJson<Approx>(
      `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=5&option=1`,
    );
    const rxcui = approx?.approximateGroup?.candidate?.[0]?.rxcui;
    if (!rxcui) return null;

    type Props = { properties?: { name: string; tty: string } };
    type Related = { relatedGroup?: { conceptGroup?: { tty: string; conceptProperties?: { name: string }[] }[] } };
    const [props, related] = await Promise.all([
      getJson<Props>(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`),
      getJson<Related>(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=IN+MIN+BN`),
    ]);
    if (!props?.properties) return null;
    const groups = related?.relatedGroup?.conceptGroup ?? [];
    const pick = (tty: string[]) =>
      groups.filter((g) => tty.includes(g.tty)).flatMap((g) => (g.conceptProperties ?? []).map((c) => c.name.toLowerCase()));
    const { tty } = props.properties;
    const ingredients = pick(["IN"]);
    if (tty === "IN" && !ingredients.length) ingredients.push(props.properties.name.toLowerCase());
    const brands = pick(["BN"]);

    // Guard against fuzzy matches to an unrelated drug: the typed name must overlap the match.
    const typed = name.split(/[^a-z]+/).filter((w) => w.length > 3);
    const known = [props.properties.name, ...ingredients, ...brands].join(" ").toLowerCase();
    if (!typed.some((w) => known.includes(w))) return null;

    return { rxcui, name: props.properties.name, tty, ingredients, brands };
  } catch {
    return null; // RxNorm down: continue with the typed name
  }
}

// ---------------- openFDA ----------------

type FdaLabel = Record<string, unknown> & {
  set_id?: string;
  effective_time?: string;
  openfda?: Record<string, string[] | undefined>;
};

function fdaUrl(search: string, limit: number) {
  const key = process.env.OPENFDA_API_KEY ? `&api_key=${process.env.OPENFDA_API_KEY}` : "";
  return `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(search)}&limit=${limit}${key}`;
}

export function ndcCandidates(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  if (/\d+-\d+(-\d+)?/.test(raw.trim())) return [raw.trim()];
  let d = digits;
  if (d.length === 13 && d.startsWith("0")) d = d.slice(1); // EAN-13 wrapper around a UPC
  if (d.length === 12 && d.startsWith("3")) d = d.slice(1, 11); // UPC-A: "3" + NDC10 + check digit
  if (d.length === 11) {
    const [a, b, c] = [d.slice(0, 5), d.slice(5, 9), d.slice(9)];
    const out: string[] = [];
    if (a.startsWith("0")) out.push(`${a.slice(1)}-${b}-${c}`);
    if (b.startsWith("0")) out.push(`${a}-${b.slice(1)}-${c}`);
    if (c.startsWith("0")) out.push(`${a}-${b}-${c.slice(1)}`);
    return out;
  }
  if (d.length !== 10) return [];
  return [`${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`, `${d.slice(0, 5)}-${d.slice(5, 8)}-${d.slice(8)}`, `${d.slice(0, 5)}-${d.slice(5, 9)}-${d.slice(9)}`];
}

async function searchFda(search: string, limit = 10): Promise<FdaLabel[]> {
  const body = await getJson<{ results?: FdaLabel[] }>(fdaUrl(search, limit));
  return body?.results ?? [];
}

function fdaText(label: FdaLabel, fields: string[]) {
  return clean(
    fields
      .flatMap((f) => (Array.isArray(label[f]) ? (label[f] as string[]) : []))
      .join(" "),
  );
}

function scoreLabel(label: FdaLabel, wantedGeneric: string, form: string) {
  const generic = (label.openfda?.generic_name ?? []).join(" ").toLowerCase();
  let score = 0;
  if (wantedGeneric && generic === wantedGeneric) score += 4;
  if (label.indications_and_usage || label.purpose) score += 2;
  if (label.dosage_and_administration) score += 2;
  if (form && JSON.stringify(label.spl_product_data_elements ?? "").toLowerCase().includes(form.toLowerCase().replace(/s$/, ""))) score += 1;
  return score + Number(label.effective_time ?? 0) / 1e9; // newer label wins ties
}

async function findFdaLabel(q: MedQuery, rx: RxMatch | null): Promise<FoundLabel | null> {
  const typed = toUsName(q.name).replace(/"/g, "");
  const generic = rx?.ingredients.length ? rx.ingredients.join(" and ") : typed;
  const searches: string[] = [];
  if (q.ndc) {
    const c = ndcCandidates(q.ndc);
    if (c.length) searches.push(c.map((n) => `openfda.package_ndc:"${n}"`).join(" "));
  }
  if (rx && ["SCD", "SBD", "GPCK", "BPCK"].includes(rx.tty)) searches.push(`openfda.rxcui:"${rx.rxcui}"`);
  searches.push(`openfda.generic_name:"${generic}"`);
  searches.push(`openfda.brand_name:"${typed}"`);
  if (generic !== typed) searches.push(`openfda.generic_name:"${typed}"`);

  for (const s of searches) {
    const results = await searchFda(s);
    if (!results.length) continue;
    const best = results.sort((a, b) => scoreLabel(b, generic, q.form) - scoreLabel(a, generic, q.form))[0];
    const sections: Sections = {};
    (Object.keys(FDA_FIELDS) as SectionKey[]).forEach((k) => {
      const t = fdaText(best, FDA_FIELDS[k]);
      if (t) sections[k] = t;
    });
    if (!sections.indications && !sections.purpose && !sections.dosage) continue;
    const of = best.openfda ?? {};
    const genericNames = (of.generic_name ?? of.substance_name ?? []).flatMap((g) => g.toLowerCase().split(/\s+and\s+|,\s*/));
    const date = best.effective_time?.replace(/^(\d{4})(\d{2})(\d{2}).*/, "$1-$2-$3");
    return {
      sections,
      matchedName: rx?.name ? rx.name.charAt(0).toUpperCase() + rx.name.slice(1) : titleCase([of.brand_name?.[0], of.generic_name?.[0]].filter(Boolean).join(" · ")),
      genericNames: [...new Set([...(rx?.ingredients ?? []), ...genericNames])],
      brandNames: [...new Set((of.brand_name ?? []).map((b) => b.toLowerCase()))],
      pharmClasses: [...(of.pharm_class_epc ?? []), ...(of.pharm_class_moa ?? [])],
      source: {
        name: "openFDA",
        url: best.set_id ? `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${best.set_id}` : "https://open.fda.gov/apis/drug/label/",
        updated: date,
      },
    };
  }
  return null;
}

// ---------------- DailyMed (fallback) ----------------

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function findDailyMedLabel(q: MedQuery, rx: RxMatch | null): Promise<FoundLabel | null> {
  const name = rx?.ingredients[0] ?? toUsName(q.name);
  const list = await getJson<{ data?: { setid: string; title: string }[] }>(
    `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(name)}&pagesize=5`,
  );
  const hit = list?.data?.[0];
  if (!hit) return null;
  const res = await fetch(`https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${hit.setid}.xml`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  const xml = await res.text();

  // Find every LOINC section code; a section runs until the next non-"unclassified" section code.
  const re = /<code code="(\d{4,5}-\d)" codeSystem="2\.16\.840\.1\.113883\.6\.1"/g;
  const marks: { code: string; index: number }[] = [];
  for (let m = re.exec(xml); m; m = re.exec(xml)) marks.push({ code: m[1], index: m.index });
  const sections: Sections = {};
  marks.forEach((mark, i) => {
    const key = SPL_CODES[mark.code];
    if (!key) return;
    const next = marks.slice(i + 1).find((n) => n.code !== "42229-5");
    const text = clean(decodeEntities(xml.slice(mark.index, next?.index ?? xml.length).replace(/<[^>]+>/g, " ")));
    if (text) sections[key] = clean(`${sections[key] ?? ""} ${text}`);
  });
  if (!sections.indications && !sections.purpose && !sections.dosage) return null;
  return {
    sections,
    matchedName: titleCase(hit.title.replace(/\s*\[[^\]]*\]\s*$/, "")),
    genericNames: rx?.ingredients ?? [name],
    brandNames: rx?.brands ?? [],
    pharmClasses: [],
    source: { name: "DailyMed", url: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${hit.setid}` },
  };
}

// ---------------- NAFDAC (Nigeria) ----------------

async function findNafdacLabel(product: NafdacProduct, smpcUrl: string): Promise<FoundLabel | null> {
  const sections = await smpcSections(smpcUrl);
  if (!sections.indications && !sections.dosage && !sections.patientInfo) return null;
  return {
    sections,
    matchedName: [product.name, product.strength].filter(Boolean).join(" · "),
    genericNames: ingredientList(product.ingredients),
    brandNames: [product.name.toLowerCase()],
    pharmClasses: [],
    source: { name: "NAFDAC", url: smpcUrl },
  };
}

/** US label lookup, openFDA first, then DailyMed. */
async function findUsLabel(q: MedQuery): Promise<FoundLabel | null> {
  const rx = await rxnormNormalize(q);
  try {
    const label = await findFdaLabel(q, rx);
    if (label) return label;
  } catch {
    /* openFDA down or rate limited: try DailyMed */
  }
  try {
    return await findDailyMedLabel(q, rx);
  } catch {
    return null;
  }
}

// Shown instead of US dosing for a Nigerian pack: strengths and directions can differ between countries.
const FOREIGN_DOSING = "Directions can differ between countries and products. Follow the leaflet in your pack, or ask your pharmacist.";

// ---------------- building the result ----------------

// Characters of each section sent to the model, in priority order. The total (~10K characters, ~2.5K tokens)
// keeps one rewrite well inside Groq's free 8K tokens/minute. Sections not listed are not needed for the summary.
const MODEL_BUDGET: [SectionKey, number][] = [
  ["purpose", 300], ["indications", 1200], ["dosage", 1600], ["boxedWarning", 700], ["doNotUse", 600],
  ["askDoctor", 700], ["interactions", 1300], ["adverseReactions", 1200], ["stopUse", 600], ["warnings", 1100],
  ["contraindications", 500], ["whenUsing", 400], ["overdose", 300], ["pregnancy", 300],
];

function labelForModel(s: Sections) {
  const text = MODEL_BUDGET.filter(([k]) => s[k])
    .map(([k, max]) => `## ${SECTION_TITLES[k]}\n${cap(k === "dosage" ? summaryPart(s[k] as string) : (s[k] as string), max)}`)
    .join("\n\n");
  // Documents without standard sections (e.g. a patient leaflet) are sent as one block of the same size.
  return text.length < 1500 && s.patientInfo ? `${text}\n\n## Product information\n${cap(s.patientInfo, 9000)}` : text;
}

/** Label wording only, used when the plain-language rewrite is unavailable. */
function labelWordingResult(s: Sections) {
  // "Most common ..." sentences state a frequency, so they can be tagged as common.
  const full = clean(s.adverseReactions ?? "");
  const at = full.search(/\b(the )?most common\b/i);
  // The sentence ends at a full stop or at a "(6.1)"-style reference, whichever comes first.
  const common = at >= 0
    ? full.slice(at).match(/^.*?(\.(?=\s|$)|\(\s*\d+(\.\d+)?\s*\))/)?.[0].replace(/\s*\(\s*\d+(\.\d+)?\s*\)$/, ".").replace(/\s*•\s*/g, " ")
    : undefined;
  const adverse = [
    ...(common ? [{ text: cap(common.charAt(0).toUpperCase() + common.slice(1), 300), level: "common" as SideEffectLevel }] : []),
    ...items(s.adverseReactions, 6)
      .filter((t) => !/most common/i.test(t))
      .slice(0, common ? 2 : 3)
      .map((text) => ({ text, level: "listed" as SideEffectLevel })),
  ];
  const sideEffects: MedResult["sideEffects"] = [...adverse, ...items(s.stopUse, 3).map((text) => ({ text, level: "stop" as SideEffectLevel }))];
  const interactions = [
    ...items(s.interactions, 2).map((text) => ({ title: "Drug interactions (label)", text })),
    ...items(s.askDoctor, 2).map((text) => ({ title: "Ask before use (label)", text })),
    ...items(s.doNotUse, 1).map((text) => ({ title: "Do not use (label)", text })),
  ];
  // Patient-facing urgent signs only; skip instructions written for clinicians.
  const urgent = [s.boxedWarning, s.warnings, s.overdose]
    .flatMap((t) => items(t, 40, 300))
    .filter((t) => /allerg|overdose|emergency|poison control|medical help|right away|immediately|swelling|breathing/i.test(t))
    .filter((t) => !/\b(initiat|institut|monitoring|inquiry|supportive measures|hemodialysis|in (patients|individuals) with|has been reported|cases)\b/i.test(t));
  const what = items(s.purpose || s.indications, 4);
  const how = items(s.dosage, 8, 320);
  return {
    oneLine: what[0] ? cap(what[0], 180) : NOT_FOUND,
    whatFor: what.length ? what : [NOT_FOUND],
    howToTake: how.length ? how : [NOT_FOUND],
    sideEffects: sideEffects.length ? sideEffects : [{ text: NOT_FOUND, level: "listed" as SideEffectLevel }],
    interactions: interactions.length ? interactions : [{ title: "Interactions", text: NOT_FOUND }],
    getHelp: urgent.length ? [...new Set(urgent)].slice(0, 4) : [NOT_FOUND],
  };
}

type Rewrite = ReturnType<typeof labelWordingResult>;

/** Every number in the rewritten dosing must appear in the label's own dosing text. */
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const NUMBER_WORD_RE = new RegExp(`\\b(${NUMBER_WORDS.join("|")})\\b`, "gi");

function dosingNumbersMatch(lines: string[], dosage: string) {
  // Labels often spell numbers out ("six doses of two tablets"), so words count the same as digits.
  const nums = (t: string) =>
    (t.replace(NUMBER_WORD_RE, (w) => String(NUMBER_WORDS.indexOf(w.toLowerCase()))).replace(/(\d),(\d{3})/g, "$1$2").match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const labelNums = new Set(nums(dosage));
  return lines.every((l) => nums(l).every((n) => labelNums.has(n)));
}

const nonEmpty = (a: unknown) => Array.isArray(a) && a.length > 0;

export async function lookupLabel(q: MedQuery, lang: string, country: Country = "US", productId?: number): Promise<LabelResponse> {
  let label: FoundLabel | null = null;
  let registration: NafdacProduct | undefined;
  let foreignLabel = false;

  if (country === "NG") {
    if (productId && q.nafdac) {
      const found = await getNafdacProduct(q.nafdac, productId).catch(() => null);
      registration = found?.product;
      if (found?.smpcUrl) label = await findNafdacLabel(found.product, found.smpcUrl).catch(() => null);
    }
    if (!label) {
      // No NAFDAC document: explain the same active ingredient(s) from the US label, clearly marked.
      const name = registration ? ingredientList(registration.ingredients).join(" and ") : q.name;
      label = await findUsLabel({ ...q, name: name || q.name, strength: registration?.strength ?? q.strength });
      foreignLabel = Boolean(label);
    }
  } else {
    label = await findUsLabel(q);
  }

  if (!label) {
    return {
      status: "not_found",
      message:
        country === "NG"
          ? `We could not find official information for "${q.name}" from NAFDAC or the US label databases. This often happens with herbal products and supplements. Please ask your pharmacist.`
          : `We could not find an official label for "${q.name}". This often happens with medicines sold outside the US, herbal products and supplements. Please ask your pharmacist.`,
    };
  }

  // US dosing must never be shown, summarised or used to answer questions for a Nigerian pack.
  if (foreignLabel) delete label.sections.dosage;
  const s = label.sections;
  const fallback = labelWordingResult(s);
  let content: Rewrite = fallback;
  let plainLanguage = false;
  let notice: string | undefined;

  if (llmAvailable()) {
    try {
      const out = await generateJson<Rewrite>({
        name: "label_summary",
        system: rewritePrompt(LANGUAGES[lang] ?? "English"),
        text: `Medicine: ${label.matchedName}\n\n${label.source.name === "NAFDAC" ? "OFFICIAL PRODUCT INFORMATION (NAFDAC-approved SmPC)" : "OFFICIAL LABEL TEXT"}:\n${labelForModel(s)}`,
        schema: rewriteSchema,
        maxTokens: 1400,
      });
      if (typeof out.oneLine === "string" && nonEmpty(out.whatFor) && nonEmpty(out.howToTake)) {
        content = {
          oneLine: out.oneLine,
          whatFor: out.whatFor,
          // Safety net: if a number in the dosing is not in the label, show the label's own words.
          howToTake: s.dosage && dosingNumbersMatch(out.howToTake, s.dosage) ? out.howToTake : fallback.howToTake,
          sideEffects: nonEmpty(out.sideEffects) ? out.sideEffects : fallback.sideEffects,
          interactions: nonEmpty(out.interactions) ? out.interactions : fallback.interactions,
          getHelp: nonEmpty(out.getHelp) ? out.getHelp : fallback.getHelp,
        };
        plainLanguage = true;
      }
    } catch (e) {
      notice =
        e instanceof LlmUnavailableError && e.rateLimited
          ? "The plain-language helper is busy right now, so you are seeing the label's own words. Try again in a minute."
          : "The plain-language helper is unavailable, so you are seeing the label's own words.";
    }
  } else {
    notice = process.env.GROQ_API_KEY
      ? "The plain-language helper is busy right now, so you are seeing the label's own words. Try again in a minute."
      : "Plain-language rewriting is not set up, so you are seeing the label's own words.";
  }

  const warnings = [s.interactions, s.doNotUse, s.askDoctor, s.whenUsing, s.contraindications, s.boxedWarning, s.warnings]
    .filter(Boolean)
    .join(" ");
  const full = (Object.keys(SECTION_TITLES) as SectionKey[])
    .filter((k) => s[k])
    .map((k) => `${SECTION_TITLES[k]}: ${s[k]}`)
    .join("\n");

  const result: MedResult = {
    query: q,
    matchedName: label.matchedName,
    genericNames: label.genericNames,
    brandNames: label.brandNames,
    pharmClasses: label.pharmClasses,
    ...content,
    howToTake: foreignLabel ? [FOREIGN_DOSING] : content.howToTake,
    plainLanguage,
    language: plainLanguage ? lang : "en",
    source: label.source,
    ...(registration ? { registration } : {}),
    ...(foreignLabel ? { foreignLabel } : {}),
    labelText: { warnings: cap(warnings, 9000), full: cap(full, 14000) },
  };
  return { status: "ok", result, notice };
}
