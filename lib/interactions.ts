// "Is this safe with my other medicines?" — compares label warning text across saved medicines.
// Runs on the device. It only finds what the labels mention, so it is NOT a complete interaction check.

import type { MedResult } from "./types";

export interface LabelFinding {
  kind: "same-ingredient" | "label-mention";
  medicines: [string, string];
  title: string;
  detail: string;
  quote?: string;
}

const SYNONYMS: Record<string, string[]> = {
  acetaminophen: ["acetaminophen", "paracetamol", "apap"],
  aspirin: ["aspirin", "acetylsalicylic", "salicylate"],
  ibuprofen: ["ibuprofen"],
  naproxen: ["naproxen"],
};

// Drug classes that labels often name instead of specific drugs.
const CLASS_TERMS: { cls: RegExp; words: string[]; name: string }[] = [
  { cls: /anticoagulant|vitamin k antagonist|factor xa|thrombin inhibitor|warfarin|apixaban|rivaroxaban|heparin/i, words: ["blood thinner", "blood thinning", "anticoagula", "thinning the blood"], name: "blood thinner" },
  { cls: /nonsteroidal anti-inflammatory|ibuprofen|naproxen|diclofenac|aspirin|celecoxib/i, words: ["nsaid", "nonsteroidal anti-inflammatory"], name: "NSAID pain reliever" },
  { cls: /monoamine oxidase inhibitor|phenelzine|selegiline|tranylcypromine/i, words: ["maoi", "monoamine oxidase"], name: "MAOI" },
  { cls: /diuretic|furosemide|hydrochlorothiazide|spironolactone/i, words: ["diuretic", "water pill"], name: "diuretic" },
  { cls: /corticosteroid|prednis|dexamethasone|hydrocortisone/i, words: ["corticosteroid", "steroid"], name: "steroid" },
  { cls: /serotonin reuptake inhibitor|sertraline|fluoxetine|citalopram|paroxetine/i, words: ["ssri", "serotonin", "antidepressant"], name: "antidepressant" },
  { cls: /angiotensin converting enzyme|lisinopril|enalapril|ramipril/i, words: ["ace inhibitor"], name: "ACE inhibitor" },
  { cls: /angiotensin 2 receptor|losartan|valsartan/i, words: ["angiotensin receptor"], name: "blood pressure medicine" },
  { cls: /benzodiazepine|diazepam|lorazepam|alprazolam/i, words: ["benzodiazepine", "sedative", "tranquilizer"], name: "sedative" },
  { cls: /opioid|codeine|tramadol|morphine|oxycodone/i, words: ["opioid", "narcotic"], name: "opioid" },
  { cls: /histamine-1|antihistamine|diphenhydramine|chlorphenamine|cetirizine|loratadine/i, words: ["antihistamine"], name: "antihistamine" },
  { cls: /insulin|metformin|sulfonylurea|glipizide|glyburide|glimepiride/i, words: ["diabetes drug", "diabetes medicine", "insulin"], name: "diabetes medicine" },
];

const displayName = (r: MedResult) => `${r.query.name}${r.query.strength ? " " + r.query.strength : ""}`;

function ingredientSet(r: MedResult) {
  const names = new Set<string>();
  [...r.genericNames, r.query.name].forEach((n) => {
    const low = n.toLowerCase().trim();
    if (!low) return;
    names.add(low);
    Object.entries(SYNONYMS).forEach(([key, syns]) => {
      if (syns.some((s) => low.includes(s))) syns.concat(key).forEach((s) => names.add(s));
    });
  });
  return names;
}

/** Words that, if found in another label's warnings, refer to this medicine. */
function mentionTerms(r: MedResult): { term: string; why: string }[] {
  const terms = [...ingredientSet(r), ...r.brandNames.map((b) => b.toLowerCase())]
    .filter((t) => t.length > 3)
    .map((term) => ({ term, why: term }));
  const profile = [...r.pharmClasses, ...r.genericNames, r.query.name].join(" ");
  CLASS_TERMS.forEach((c) => {
    if (c.cls.test(profile)) c.words.forEach((w) => terms.push({ term: w, why: c.name }));
  });
  return terms;
}

function quoteAround(text: string, index: number) {
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, index - 110)));
  const end = text.indexOf(" ", Math.min(text.length, index + 150));
  return `${start > 0 ? "…" : ""}${text.slice(start, end === -1 ? undefined : end).trim()}${end !== -1 ? "…" : ""}`;
}

function findMention(from: MedResult, about: MedResult): LabelFinding | null {
  const text = from.labelText?.warnings ?? "";
  const lower = text.toLowerCase();
  for (const { term, why } of mentionTerms(about)) {
    const idx = lower.search(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    if (idx >= 0) {
      const article = /^[aeiou]|^(nsaid|maoi)/i.test(why) ? "an" : "a";
      const what = why === term ? "" : `, and ${about.query.name} is ${article} ${why}`;
      return {
        kind: "label-mention",
        medicines: [displayName(from), displayName(about)],
        title: `The ${from.query.name} label mentions "${term}"`,
        detail: `The warnings on the ${from.query.name} label mention "${term}"${what}. Ask your pharmacist before taking ${from.query.name} and ${about.query.name} together.`,
        quote: quoteAround(text, idx),
      };
    }
  }
  return null;
}

export function compareLabels(target: MedResult, others: MedResult[]): LabelFinding[] {
  const findings: LabelFinding[] = [];
  const mine = ingredientSet(target);
  for (const other of others) {
    const shared = [...ingredientSet(other)].filter((n) => mine.has(n) && n.length > 3);
    if (shared.length) {
      const name = shared[0];
      findings.push({
        kind: "same-ingredient",
        medicines: [displayName(target), displayName(other)],
        title: `Both contain ${name}`,
        detail: `${target.query.name} and ${other.query.name} share an active ingredient. Taking both could mean taking too much. Ask your pharmacist.`,
      });
    }
    const a = findMention(target, other);
    const b = findMention(other, target);
    if (a) findings.push(a);
    if (b) findings.push(b);
  }
  return findings;
}

/** Checks every pair in a list of saved medicines. */
export function compareAll(meds: MedResult[]): LabelFinding[] {
  const out: LabelFinding[] = [];
  meds.forEach((m, i) => out.push(...compareLabels(m, meds.slice(i + 1))));
  return out;
}
