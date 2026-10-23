import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { Logo } from "@/components/Logo";

const TRUST = ["Answers from the label", "Confirm before you read", "Voice mode built in", "Phone and web"];

const FEATURES: { icon: IconName; tone: string; title: string; text: string }[] = [
  { icon: "scan", tone: "bg-mint-1 text-teal", title: "Scan the box", text: "Take a photo of any medicine box. You confirm the name and strength first, so a misread never reaches you." },
  { icon: "shield", tone: "bg-caution text-[#8a5a00]", title: "Check the product", text: "Save your allergies and goals once. MedLens flags ingredients that clash with them, in simple language." },
  { icon: "speaker", tone: "bg-mint-1 text-teal", title: "Listen instead", text: "Large text, high contrast, and a voice mode that reads results aloud and answers spoken questions." },
];

const STEPS = [
  { title: "Snap the box", text: "Use your camera, or scan the barcode if the text is hard to read." },
  { title: "Confirm the details", text: "Check the medicine name and strength MedLens found. Fix them if anything is off." },
  { title: "Read or listen", text: "Get the label explained in plain words, with warnings you can hear out loud." },
];

const SAFETY = [
  { title: "Label facts only", text: "Answers come from the medicine's own label text, never guesswork." },
  { title: "You confirm first", text: "Nothing is shown until you check the name and strength." },
  { title: "No personal dosing advice", text: "You see what the label says, nothing more." },
  { title: "Not a complete interaction check", text: "It flags what the label mentions, so always ask a pharmacist." },
];

export default function Landing() {
  return (
    <div className="overflow-x-clip">
      {/* Header */}
      <header className="sticky top-3 z-40 mx-auto mt-3 max-w-6xl px-3">
        <nav className="glass flex items-center justify-between gap-3 rounded-[24px] bg-white/90 px-4 py-2.5" aria-label="Main">
          <Link href="/" aria-label="MedLens home">
            <Logo size={36} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-6">
            <a href="#how" className="hidden font-bold text-ink hover:text-teal sm:inline">How it works</a>
            <a href="#safety" className="hidden font-bold text-ink hover:text-teal sm:inline">Safety</a>
            <Link href="/scan" className="btn glass-teal min-h-11 whitespace-nowrap px-4 sm:px-5">Start scanning</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate -mt-20 pt-28 pb-16 sm:pb-24">
          <div className="dot-grid absolute inset-0 -z-10" aria-hidden="true" />
          <span className="absolute -left-16 top-24 -z-10 size-56 rounded-full bg-mint-3" aria-hidden="true" />
          <span className="absolute -right-10 top-16 -z-10 size-48 rounded-full border-[18px] border-mint-5" aria-hidden="true" />
          <span className="absolute left-[42%] top-[70%] -z-10 size-16 rounded-full bg-amber-soft/70" aria-hidden="true" />

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h1 className="text-[clamp(2.1rem,4.2vw+0.9rem,3.2rem)] font-bold leading-[1.05] text-teal">
                Understand your medicine in seconds.
              </h1>
              <p className="mt-5 max-w-xl text-[1.1rem] text-muted">
                Point your camera at any medicine box. MedLens explains what it is for, what the label says about taking it, and what to watch
                for, in plain words. Read it, or have it read aloud.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/scan" className="btn glass-teal px-7">
                  <Icon name="scan" /> Scan a medicine
                </Link>
                <a href="#how" className="btn glass px-7 text-teal">See how it works</a>
              </div>
              <p className="mt-5 flex items-center gap-2 text-[0.92rem] text-muted">
                <Icon name="info" size={18} /> MedLens explains labels. It never replaces your doctor or pharmacist.
              </p>
            </div>

            {/* Phone-style preview card (sample content) */}
            <div className="relative mx-auto w-full max-w-[360px]" role="img" aria-label="Example of the confirm step in MedLens">
              <span className="absolute left-1/2 top-1/2 -z-10 size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint-1" aria-hidden="true" />
              <span className="absolute -right-6 bottom-10 -z-10 size-20 rounded-full bg-amber" aria-hidden="true" />
              <div className="card rounded-[28px] p-5" aria-hidden="true">
                <p className="text-[0.75rem] font-bold tracking-[0.12em] text-muted">STEP 2 OF 3 · CONFIRM</p>
                <div className="mt-3 rounded-2xl bg-mint-1 p-4">
                  <p className="text-[0.85rem] text-muted">We found</p>
                  <p className="font-display text-[1.3rem] font-bold text-teal">[Medicine name] [strength]</p>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-1 text-[0.82rem] font-bold text-white">
                    <Icon name="check" size={16} /> Yes, that is right
                  </span>
                </div>
                <ul className="mt-4 space-y-3 text-[0.95rem]">
                  <li className="border-b border-line pb-2.5 font-bold">What it is for</li>
                  <li className="border-b border-line pb-2.5">
                    <span className="font-bold">How the label says to take it</span>
                    <span className="block text-[0.82rem] text-muted">Label wording only, no personal dosing</span>
                  </li>
                  <li className="font-bold">Watch out for</li>
                </ul>
                <span className="btn btn-outline mt-4 w-full min-h-11">
                  <Icon name="speaker" /> Read aloud
                </span>
                <p className="mt-3 rounded-xl bg-caution px-3 py-2 text-[0.82rem] text-caution-ink">
                  Ask your doctor or pharmacist before making any medical decision.
                </p>
              </div>
              <span className="glass absolute -left-5 top-8 flex items-center gap-2 rounded-full px-3.5 py-2 text-[0.85rem] font-bold text-teal" aria-hidden="true">
                <Icon name="mic" size={18} /> Voice mode on
              </span>
              <span className="glass absolute -bottom-4 -right-3 flex items-center gap-2 rounded-full px-3.5 py-2 text-[0.85rem] font-bold text-teal" aria-hidden="true">
                <Icon name="check" size={18} /> Confirmed by you
              </span>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="bg-mint-1 py-5">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-3 px-5 md:grid-cols-4">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 font-bold text-teal">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-teal text-white">
                  <Icon name="check" size={16} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* Features */}
        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-center text-[clamp(1.7rem,2.6vw+0.8rem,2.5rem)] font-bold text-teal">Three things MedLens does well</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {FEATURES.map((f) => (
                <article key={f.title} className="card p-6">
                  <span className={`grid size-14 place-items-center rounded-2xl ${f.tone}`}>
                    <Icon name={f.icon} size={28} />
                  </span>
                  <h3 className="mt-4 text-[1.35rem] font-semibold text-teal">{f.title}</h3>
                  <p className="mt-2 text-muted">{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-24 bg-mint-2 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-center text-[clamp(1.7rem,2.6vw+0.8rem,2.5rem)] font-bold text-teal">How it works</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-teal font-display text-[1.4rem] font-bold text-white">{i + 1}</span>
                  <h3 className="mt-4 text-[1.3rem] font-semibold text-teal">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="rounded-[28px] border border-amber-soft bg-caution p-6 sm:p-10">
              <h2 className="text-[clamp(1.6rem,2.4vw+0.8rem,2.3rem)] font-bold text-caution-ink">Built to send you to a professional</h2>
              <p className="mt-3 max-w-2xl text-caution-ink">
                MedLens helps you understand a label. Decisions about your health belong with your doctor or pharmacist.
              </p>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2">
                {SAFETY.map((s) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#8a5a00]">
                      <Icon name="shield" size={20} />
                    </span>
                    <span>
                      <span className="block font-bold text-caution-ink">{s.title}</span>
                      <span className="text-caution-ink/85">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Closing band */}
        <section className="relative overflow-hidden bg-teal py-16 text-center text-white">
          <span className="absolute -left-10 -top-16 size-56 rounded-full bg-teal-soft" aria-hidden="true" />
          <span className="absolute -bottom-8 right-[12%] size-24 rounded-full bg-amber" aria-hidden="true" />
          <div className="relative px-5">
            <h2 className="text-[clamp(1.7rem,2.6vw+0.8rem,2.5rem)] font-bold">Ready to read your first label?</h2>
            <Link href="/scan" className="btn glass-on-teal mt-7 px-8">
              <Icon name="scan" /> Start scanning
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  const product = [
    ["Scan a medicine", "/scan"],
    ["Product checker", "/checker"],
    ["Voice mode", "/settings"],
    ["How it works", "/#how"],
  ];
  const safety = [
    ["Medical disclaimer", "/legal#disclaimer"],
    ["How label data is used", "/legal#data"],
    ["Privacy", "/legal#privacy"],
    ["Terms", "/legal#terms"],
  ];
  return (
    <footer className="bg-teal-deep text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo onDark size={38} />
          <p className="mt-4 max-w-sm">Medicine labels, explained in plain words. On your phone or in any browser.</p>
        </div>
        {[
          ["Product", product],
          ["Safety", safety],
        ].map(([title, links]) => (
          <div key={title as string}>
            <h3 className="font-sans text-[1rem] font-bold text-white">{title as string}</h3>
            <ul className="mt-3 space-y-2">
              {(links as string[][]).map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-[#CFE5DF] hover:text-white hover:underline">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-6xl border-t border-white/15 px-5 py-8 text-[0.9rem]">
        <p className="max-w-4xl">
          MedLens gives general information taken from medicine labels. It is not medical advice, and it does not diagnose or recommend
          treatment. Always ask your doctor or pharmacist before making decisions about your medicines.
        </p>
        <p className="mt-4 text-white/60">© 2026 MedLens. All rights reserved.</p>
      </div>
    </footer>
  );
}
