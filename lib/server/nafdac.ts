// Nigerian medicines: the NAFDAC Greenbook (greenbook.nafdac.gov.ng) is the public register of every product
// NAFDAC has approved. Most drug records link to the approved Summary of Product Characteristics (SmPC) as a PDF,
// which is the official product information we explain. Nothing here is answered from memory.

import type { NafdacProduct } from "../types";
import type { Sections } from "./label";

const GREENBOOK = "https://greenbook.nafdac.gov.ng";
const SMPC_HOST = "admin.greenbook.nafdac.gov.ng";

interface GreenbookRow {
  product_id: number;
  product_name: string;
  strength: string | null;
  NAFDAC: string;
  status: string;
  expiry_date?: string | null;
  smpc?: string | null;
  ingredient?: { ingredient_name: string } | null;
  form?: { name: string } | null;
  applicant?: { name: string } | null;
  product_category?: { name: string } | null;
}

/** Greenbook's table is served as DataTables JSON; column indexes match the public search page. */
async function queryGreenbook(filters: { name?: string; nrn?: string; ingredient?: string; strength?: string }, length = 100) {
  const p = new URLSearchParams({ draw: "1", start: "0", length: String(length), "search[value]": "" });
  const column = (i: number, data: string, value?: string) => {
    if (!value) return;
    p.set(`columns[${i}][data]`, data);
    p.set(`columns[${i}][name]`, data);
    p.set(`columns[${i}][searchable]`, "true");
    p.set(`columns[${i}][search][value]`, value);
  };
  column(0, "product_name", filters.name);
  column(5, "NAFDAC", filters.nrn);
  column(8, "strength", filters.strength);
  if (filters.ingredient) p.set("search_ingredient", filters.ingredient);
  const res = await fetch(`${GREENBOOK}/?${p}`, {
    headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Greenbook responded ${res.status}`);
  return ((await res.json()) as { data?: GreenbookRow[] }).data ?? [];
}

export const normalizeNrn = (s = "") => s.toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
const words = (s = "") => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];
const numbers = (s = "") => (s.replace(/,/g, ".").match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const FORM_WORDS = new Set(["tablet", "tablets", "caplet", "caplets", "capsule", "capsules", "syrup", "suspension", "drops", "injection", "cream", "ointment", "gel", "dispersible", "powder", "oral", "solution"]);

/** Splits "Ampicillin (Ampicillin Trihydrate); Cloxacillin" into ["ampicillin", "cloxacillin"]. */
export function ingredientList(s: string) {
  return s
    .split(/;|\+|,|\band\b/i)
    .map((i) => i.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean);
}

function toProduct(r: GreenbookRow): NafdacProduct {
  return {
    id: r.product_id,
    // Greenbook appends internal markers such as "##", "**", "_" and "(check description)".
    name: r.product_name.replace(/[#*_]+/g, "").replace(/\((check description|duplicate|strength format)\)/gi, "").replace(/\s+/g, " ").trim(),
    ingredients: r.ingredient?.ingredient_name ?? "",
    strength: (r.strength ?? "").trim(),
    form: r.form?.name ?? "",
    nrn: r.NAFDAC,
    applicant: r.applicant?.name?.trim() ?? "",
    status: r.status,
    expires: r.expiry_date ?? undefined,
    hasSmpc: Boolean(r.smpc && new URL(r.smpc, GREENBOOK).host === SMPC_HOST),
    url: `${GREENBOOK}/products/details/${r.product_id}`,
  };
}

/**
 * Finds registered products matching what the user confirmed, best first.
 * A NAFDAC number is exact; otherwise brand, ingredient, strength and form are matched.
 */
export async function findNafdacProducts(q: { name: string; strength: string; form: string; brand?: string; nafdac?: string }, limit = 6) {
  const nrn = normalizeNrn(q.nafdac);
  const typedIngredients = ingredientList(q.name.replace(/\//g, ";"));
  const strengthNumber = numbers(q.strength)[0];
  const brandWords = words(q.brand || q.name).filter((w) => !FORM_WORDS.has(w));

  const searches: Promise<GreenbookRow[]>[] = [];
  if (nrn) searches.push(queryGreenbook({ nrn }, 10));
  if (q.brand) searches.push(queryGreenbook({ name: q.brand }, 30));
  searches.push(queryGreenbook({ name: q.name }, 30));
  if (typedIngredients[0]) {
    searches.push(queryGreenbook({ ingredient: typedIngredients[0], strength: strengthNumber ? String(strengthNumber) : undefined }));
  }
  const settled = await Promise.allSettled(searches);
  if (settled.every((s) => s.status === "rejected")) throw new Error("Greenbook unavailable");

  const rows = new Map<number, GreenbookRow>();
  settled.forEach((s) => s.status === "fulfilled" && s.value.forEach((r) => rows.set(r.product_id, r)));

  const scored = [...rows.values()]
    .filter((r) => !/device|disinfect|veterinary/i.test(r.product_category?.name ?? ""))
    .map((r) => {
      const p = toProduct(r);
      const ings = ingredientList(p.ingredients);
      const name = p.name.toLowerCase();
      let score = 0;
      if (nrn && normalizeNrn(p.nrn) === nrn) score += 100;
      if (brandWords.length && brandWords.every((w) => name.includes(w))) score += 10;
      else score += brandWords.filter((w) => name.includes(w)).length * 2;
      if (typedIngredients.length && ings.length === typedIngredients.length && typedIngredients.every((t) => ings.some((i) => i.includes(t) || t.includes(i)))) score += 8;
      else if (typedIngredients.some((t) => ings.some((i) => i.includes(t)))) score += 2;
      const typedNums = numbers(q.strength);
      if (typedNums.length && typedNums.every((n) => numbers(p.strength).includes(n))) score += 6;
      const form = q.form.toLowerCase().replace(/s$/, "");
      if (form && p.form.toLowerCase().includes(form)) score += 3;
      if (p.status === "Active") score += 4;
      if (p.hasSmpc) score += 2;
      return { p, score };
    })
    .filter((x) => x.score >= 8) // must match on at least the ingredient or brand, not just "Active"
    .sort((a, b) => b.score - a.score);

  // An exact NAFDAC number match is the answer; otherwise let the user choose among the best matches.
  const exact = scored.filter((x) => x.score >= 100).map((x) => x.p);
  // Greenbook sometimes lists one registration twice; keep the best-scoring record per number.
  const seen = new Set<string>();
  const unique = scored.map((x) => x.p).filter((p) => !seen.has(normalizeNrn(p.nrn)) && seen.add(normalizeNrn(p.nrn)));
  return { exact: exact[0] ?? null, candidates: (exact.length ? exact : unique).slice(0, limit) };
}

/** Re-reads a product from Greenbook by its number, so the PDF link always comes from NAFDAC, never from the client. */
export async function getNafdacProduct(nrn: string, id: number) {
  const rows = await queryGreenbook({ nrn: normalizeNrn(nrn) }, 20);
  const row = rows.find((r) => r.product_id === id);
  return row ? { product: toProduct(row), smpcUrl: row.smpc ?? null } : null;
}

// SmPC sections are numbered the same way in every document (EU/WHO template).
const SMPC_SECTIONS: Record<string, keyof Sections> = {
  "1": "indications", "2": "dosage", "3": "contraindications", "4": "warnings", "5": "interactions",
  "6": "pregnancy", "7": "whenUsing", "8": "adverseReactions", "9": "overdose",
};

// Standard SmPC headings, removed from the start of each section's text.
const SMPC_HEADING =
  /^(therapeutic indications?|posology and (method|mode) of administration( posology)?|contra-?indications|special warnings( and (special )?precautions( for use)?)?|interactions? with other (medicinal products|medicaments)( and other forms of interactions?)?|(fertility, )?pregnancy and (lactation|breast-?feeding)|effects? on (the )?ability to drive and (to )?use machines|undesirable effects|side effects|overdos(e|age))[\s:.]*/i;

/** Downloads the SmPC PDF and splits section 4 ("Clinical particulars") into label sections. */
export async function smpcSections(url: string): Promise<Sections> {
  const u = new URL(url, GREENBOOK);
  if (u.host !== SMPC_HOST || u.protocol !== "https:") return {};
  const res = await fetch(u, { signal: AbortSignal.timeout(15000), next: { revalidate: 604800 } });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) return {};
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > 15_000_000) return {};

  const { extractText, getDocumentProxy } = await import("unpdf");
  const { text } = await extractText(await getDocumentProxy(buf), { mergePages: true });
  // Clinical particulars end where section 5 (pharmacological properties) begins.
  const end = text.search(/\n\s*5\.?\s*(\d\.?)?\s*pharmacolog/i);
  const clinical = end > 0 ? text.slice(0, end) : text;

  const re = /(?:^|\n)\s*4\s?\.\s?([1-9])\.?\s+(?=[A-Za-z])/g;
  const marks = [...clinical.matchAll(re)].map((m) => ({ n: m[1], start: m.index!, body: m.index! + m[0].length }));
  const sections: Sections = {};
  marks.forEach((m, i) => {
    const key = SMPC_SECTIONS[m.n];
    const chunk = clinical
      .slice(m.body, marks[i + 1]?.start ?? clinical.length)
      .replace(/\s+/g, " ")
      .replace(SMPC_HEADING, "")
      .trim();
    // A table of contents repeats the headings; keep the longest text for each section.
    if (key && chunk.length > (sections[key]?.length ?? 0)) sections[key] = chunk;
  });
  // Documents that do not follow the template (for example patient leaflets) are passed on whole.
  if (!sections.indications && !sections.dosage && text.trim().length > 300) sections.patientInfo = text.replace(/\s+/g, " ").trim();
  return sections;
}
