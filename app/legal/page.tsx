import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Safety, privacy and terms" };

const SECTIONS = [
  {
    id: "disclaimer",
    title: "Medical disclaimer",
    body: [
      "MedLens gives general information taken from official medicine labels. It is not medical advice. It does not diagnose, recommend treatment, or work out a dose for you.",
      "Dosing shown in MedLens is the label's own wording only. Interaction warnings come only from label text and are not a complete interaction check.",
      "Always ask your doctor or pharmacist before you start, stop or change any medicine. In an emergency, call your local emergency number.",
    ],
  },
  {
    id: "data",
    title: "How label data is used",
    body: [
      "After you confirm a medicine's name, strength and form, MedLens normalizes the name with RxNorm (US National Library of Medicine) and fetches the official label from openFDA, or DailyMed if openFDA has no match.",
      "A language model (run on Groq, free tier) may rewrite that label text in plain words. It is told to use only the label text and to say \"Not found on the label\" when the label does not cover something. Numbers in dosing are checked against the label; if they do not match, the label's own words are shown instead.",
      "These sources are US-focused. Medicines sold elsewhere, herbal products and supplements may not be found. When that happens, MedLens says so and asks you to see your pharmacist.",
      "Label summaries (never personal data) are cached by drug name to keep the service free and fast. Product barcodes are looked up in Open Food Facts.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    body: [
      "Your allergies, goals, saved medicines and settings are stored only on your device (browser storage). They are never sent to our servers. Ingredient matching happens on your device.",
      "Photos you take are sent once to the vision model to read the package text, and are not stored. If the model is unavailable, text is read on your device with Tesseract.js.",
      "Spoken questions use your browser's speech recognition, which some browsers process on their own servers. You can always type instead.",
      "\"Clear all my data\" in Settings removes everything MedLens stored on this device.",
    ],
  },
  {
    id: "terms",
    title: "Terms",
    body: [
      "MedLens is provided free, as is, for general information. By using it you agree that it does not replace professional medical advice and that you will check important information with your doctor or pharmacist.",
      "Medical disclaimer: MedLens is not a medical device and is not medical advice. Label text may be incomplete, out of date, or differ from the product in your hand. Always follow your own medicine's package and your healthcare professional.",
      "We are not liable for decisions made using MedLens. Do not use MedLens in an emergency.",
    ],
  },
];

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-6">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="MedLens home">
          <Logo size={36} />
        </Link>
        <Link href="/settings" className="btn glass text-teal">
          <Icon name="back" /> Back
        </Link>
      </div>
      <h1 className="mt-8 text-[clamp(1.8rem,2.5vw+1rem,2.5rem)] font-bold text-teal">Safety, privacy and terms</h1>
      <div className="mt-6 space-y-5">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="card scroll-mt-6 p-6">
            <h2 className="text-[1.35rem] font-semibold text-teal">{s.title}</h2>
            <div className="mt-3 space-y-3">
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-6 rounded-[18px] border border-amber-soft bg-caution px-4 py-3 text-caution-ink">
        Ask your doctor or pharmacist before making any medical decision.
      </p>
    </div>
  );
}
