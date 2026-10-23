"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { AmberNote, IconTile, PharmacistBar, ReadAloud, Tag } from "./ui";
import { getAppData } from "@/lib/store";
import { listenOnce, speak, stopSpeaking, useSpeechSupport } from "@/lib/speech";
import type { MedResult, NafdacProduct } from "@/lib/types";

const NOT_FOUND = "Not found on the label.";
const LEVEL: Record<string, { label: string; tone: "mint" | "grey" | "amber" }> = {
  common: { label: "Common", tone: "mint" },
  rare: { label: "Rare", tone: "grey" },
  listed: { label: "Listed", tone: "grey" },
  stop: { label: "Stop", tone: "amber" },
};

export const medTitle = (r: MedResult) => `${r.query.name}${r.query.strength ? " " + r.query.strength : ""}`;

export function summaryText(r: MedResult) {
  return [
    `${medTitle(r)}.`,
    r.registration ? registrationSpeech(r.registration) : "",
    r.foreignLabel ? "This explains the US label for the same active ingredient. Follow the leaflet in your pack." : "",
    `In one line: ${r.oneLine}`,
    `What it is for: ${r.whatFor.join(" ")}`,
    `How the label says to take it: ${r.howToTake.join(" ")} This is label wording only.`,
    `Possible side effects: ${r.sideEffects.map((s) => s.text).join(" ")}`,
    `Interactions to know about: ${r.interactions.map((i) => `${i.title}. ${i.text}`).join(" ")} This is not a complete interaction check.`,
    `Get help right away if: ${r.getHelp.join(" ")}`,
    "Ask your doctor or pharmacist before any medical decision.",
  ]
    .filter(Boolean)
    .join(" ");
}

const isActive = (reg: NafdacProduct) => reg.status === "Active";

function registrationSpeech(reg: NafdacProduct) {
  return isActive(reg)
    ? `Registered with NAFDAC as ${reg.name}${reg.applicant ? ` by ${reg.applicant}` : ""}, number ${reg.nrn}. Check that this matches your pack.`
    : `The NAFDAC Greenbook lists this registration as ${reg.status.toLowerCase()}. Ask your pharmacist before using this pack.`;
}

/** NAFDAC registration check for Nigerian packs: helps people spot unregistered or lapsed products. */
function RegistrationCard({ reg }: { reg: NafdacProduct }) {
  const active = isActive(reg);
  return (
    <section
      className={`rounded-[24px] border p-5 ${active ? "border-mint-5 bg-white text-ink" : "border-amber-soft bg-caution text-caution-ink"}`}
      aria-labelledby="reg-title"
    >
      <div className="flex items-center gap-3">
        <IconTile icon={active ? "check" : "warning"} tone={active ? "mint" : "amber"} size="sm" />
        <h2 id="reg-title" className={`flex-1 text-[1.15rem] font-semibold leading-tight ${active ? "text-teal" : ""}`}>
          {active ? "Registered with NAFDAC" : "NAFDAC registration not active"}
        </h2>
        <Tag tone={active ? "mint" : "amber"}>{reg.status}</Tag>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.95rem]">
        <dt className="text-muted">Product</dt>
        <dd className="font-bold">{[reg.name, reg.strength].filter(Boolean).join(" · ")}</dd>
        <dt className="text-muted">Company</dt>
        <dd>{reg.applicant || "Not listed"}</dd>
        <dt className="text-muted">Reg. No.</dt>
        <dd className="font-bold tracking-wide">{reg.nrn}</dd>
      </dl>
      <p className="mt-3 text-[0.92rem]">
        {active
          ? "Check that the name, company and number match your pack. If they do not, the pack may not be genuine. Ask your pharmacist."
          : "Ask your pharmacist before using this pack."}{" "}
        <a href={reg.url} target="_blank" rel="noreferrer" className="font-bold text-teal underline">
          Check on the NAFDAC Greenbook
        </a>
      </p>
    </section>
  );
}

function Section({ id, icon, tone = "mint", title, speakText, lang, children }: { id: string; icon: IconName; tone?: "mint" | "amber" | "red"; title: string; speakText: string; lang: string; children: React.ReactNode }) {
  return (
    <section className="card p-5" aria-labelledby={`${id}-title`}>
      <div className="mb-3 flex items-center gap-3">
        <IconTile icon={icon} tone={tone} size="sm" />
        <h2 id={`${id}-title`} className="flex-1 text-[1.2rem] font-semibold leading-tight text-teal">{title}</h2>
        <ReadAloud id={id} lang={lang} text={`${title}. ${speakText}`} label={`Read aloud: ${title}`} />
      </div>
      {children}
    </section>
  );
}

function Bullets({ items, color = "bg-teal" }: { items: string[]; color?: string }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) =>
        t === NOT_FOUND ? (
          <li key={i} className="italic text-muted">Not found on the label. Ask your pharmacist.</li>
        ) : (
          <li key={i} className="flex gap-3">
            <span className={`mt-[0.6em] size-2 shrink-0 rounded-full ${color}`} />
            <span>{t}</span>
          </li>
        ),
      )}
    </ul>
  );
}

export function ResultView({ result, notice, children }: { result: MedResult; notice?: string; children?: React.ReactNode }) {
  const whole = summaryText(result);
  const lang = result.language;

  // Voice mode: read the summary aloud when the result appears, and stop reading when the user leaves it.
  useEffect(() => {
    if (getAppData().settings.voiceMode) speak(whole, "summary", undefined, lang);
    return () => stopSpeaking();
  }, [whole, lang]);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[28px] bg-teal p-5 text-white">
        <span className="absolute -right-12 -top-14 size-44 rounded-full bg-teal-soft" aria-hidden="true" />
        <span className="absolute right-5 top-5 size-7 rounded-full bg-amber" aria-hidden="true" />
        <div className="relative flex items-center gap-3 pr-8">
          <IconTile icon="pill" tone="teal" />
          <div className="min-w-0">
            <h2 className="text-[1.5rem] font-bold leading-tight">{medTitle(result)}</h2>
            <p className="text-white/85">{[result.query.form, "Confirmed by you"].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <p className="relative mt-3 text-[0.88rem] text-white/85">
          {result.source.name === "NAFDAC" ? "Matched product" : "Matched label"}: {result.matchedName}
        </p>
        <ReadAloud id="summary" lang={lang} text={whole} label="Read the whole summary aloud" wide tone="onTeal" className="relative mt-4 w-full" />
      </div>

      {result.registration && <RegistrationCard reg={result.registration} />}

      {result.foreignLabel && (
        <AmberNote icon="warning">
          We could not find NAFDAC product information for this pack, so this explains the US label for the same active
          ingredient. Directions are not shown because they can differ. Follow the leaflet in your pack.
        </AmberNote>
      )}

      {notice && (
        <p className="flex gap-2 rounded-2xl bg-[#F1F3F2] px-4 py-3 text-[0.92rem] text-muted">
          <Icon name="info" size={20} className="mt-0.5" /> {notice}
        </p>
      )}

      <section className="flex items-start gap-3 rounded-[24px] bg-mint-1 p-5" aria-label="In one line">
        <div className="flex-1">
          <p className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-teal">In one line</p>
          <p className="mt-1 font-display text-[1.25rem] font-semibold leading-snug text-ink">
            {result.oneLine === NOT_FOUND ? "Not found on the label. Ask your pharmacist." : result.oneLine}
          </p>
        </div>
        <ReadAloud id="oneline" lang={lang} text={result.oneLine} label="Read aloud: in one line" />
      </section>

      <Section lang={result.language} id="what" icon="info" title="What it is for" speakText={result.whatFor.join(" ")}>
        <Bullets items={result.whatFor} />
      </Section>

      <Section lang={result.language} id="how" icon="pill" title="How the label says to take it" speakText={`${result.howToTake.join(" ")} This is label wording only.`}>
        <Bullets items={result.howToTake} />
        <p className="mt-4 rounded-2xl bg-[#F1F3F2] px-4 py-3 text-[0.9rem] text-muted">
          This is label wording only. MedLens does not work out a dose for you.
        </p>
      </Section>

      <Section lang={result.language} id="side" icon="warning" tone="amber" title="Possible side effects" speakText={result.sideEffects.map((s) => s.text).join(" ")}>
        <ul className="divide-y divide-line">
          {result.sideEffects.map((s, i) =>
            s.text === NOT_FOUND ? (
              <li key={i} className="py-2 italic text-muted">Not found on the label. Ask your pharmacist.</li>
            ) : (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <Tag tone={LEVEL[s.level]?.tone ?? "grey"}>{LEVEL[s.level]?.label ?? "Listed"}</Tag>
                <span>{s.text}</span>
              </li>
            ),
          )}
        </ul>
      </Section>

      <Section
        lang={result.language}
        id="interactions"
        icon="shield"
        tone="amber"
        title="Interactions to know about"
        speakText={`${result.interactions.map((i) => `${i.title}. ${i.text}`).join(" ")} Based on the label text only. This is not a complete interaction check.`}
      >
        <ul className="space-y-2.5">
          {result.interactions.map((it, i) =>
            it.text === NOT_FOUND ? (
              <li key={i} className="italic text-muted">The label does not list interactions. Ask your pharmacist.</li>
            ) : (
              <li key={i} className="flex gap-3 rounded-2xl border border-amber-soft bg-caution p-3.5 text-caution-ink">
                <Icon name="warning" className="mt-0.5 text-[#8a5a00]" />
                <span>
                  <span className="block font-bold">{it.title}</span>
                  {it.text}
                </span>
              </li>
            ),
          )}
        </ul>
        <p className="mt-3 text-[0.9rem] text-muted">Based on the label text only. This is not a complete interaction check.</p>
      </Section>

      <section className="rounded-[24px] border border-danger-line bg-danger-tint p-5 text-danger-ink" aria-labelledby="help-title">
        <div className="mb-3 flex items-center gap-3">
          <IconTile icon="warning" tone="red" size="sm" />
          <h2 id="help-title" className="flex-1 text-[1.2rem] font-semibold leading-tight text-danger">Get help right away if</h2>
          <ReadAloud id="help" lang={lang} text={`Get help right away if. ${result.getHelp.join(" ")}`} label="Read aloud: get help right away" />
        </div>
        <Bullets items={result.getHelp} color="bg-danger" />
        <p className="mt-3 text-[0.9rem] font-bold">In an emergency, call your local emergency number.</p>
      </section>

      <AskBox result={result} />

      {children}

      <p className="px-2 text-center text-[0.85rem] text-muted">
        {result.source.name === "NAFDAC" ? (
          <>
            Source: NAFDAC-approved product information (SmPC) from the NAFDAC Greenbook.{" "}
            <a href={result.source.url} target="_blank" rel="noreferrer" className="font-bold text-teal underline">
              View the document
            </a>
            . Always follow the leaflet in your pack.
          </>
        ) : (
          <>
            Source: official US label from {result.source.name}
            {result.source.updated ? ` (updated ${result.source.updated})` : ""}.{" "}
            <a href={result.source.url} target="_blank" rel="noreferrer" className="font-bold text-teal underline">
              View full label
            </a>
            . {result.foreignLabel ? "It is for the same active ingredient, not your exact pack" : "Your box may differ"}, so always follow your own pack.
          </>
        )}
      </p>

      <PharmacistBar />
    </div>
  );
}

// ---------- spoken / typed questions ----------

const LOCAL_TOPICS: { re: RegExp; pick: (r: MedResult) => string }[] = [
  { re: /side effect|reaction|feel|sick|rash/i, pick: (r) => r.sideEffects.map((s) => s.text).join(" ") },
  { re: /interact|together|with (my|other|another)|alcohol|drink|other medicine/i, pick: (r) => r.interactions.map((i) => `${i.title}: ${i.text}`).join(" ") },
  { re: /emergenc|danger|urgent|overdose|too much|help/i, pick: (r) => r.getHelp.join(" ") },
  { re: /how (much|many|often)|dose|take|when|food|times/i, pick: (r) => `The label says: ${r.howToTake.join(" ")} Ask your pharmacist what is right for you.` },
  { re: /what.*(for|treat|used|do)|purpose|why/i, pick: (r) => r.whatFor.join(" ") },
];

async function answer(question: string, r: MedResult): Promise<string> {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, labelText: r.labelText.full, medicine: r.matchedName, language: getAppData().settings.language }),
    });
    if (res.ok) {
      const data = (await res.json()) as { answer?: string };
      if (data.answer) return data.answer;
    }
  } catch {
    /* offline or unavailable: answer from the sections we already have */
  }
  const topic = LOCAL_TOPICS.find((t) => t.re.test(question));
  return topic ? topic.pick(r) : "I could not find that on the label. Please ask your pharmacist.";
}

function AskBox({ result }: { result: MedResult }) {
  const { listen } = useSpeechSupport();
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<{ q: string; a: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setStatus("Looking in the label…");
    const a = await answer(q, result);
    setState({ q, a });
    setStatus(null);
    setQuestion("");
    speak(a, "answer");
  };

  const onMic = async () => {
    setStatus("Listening… ask your question now.");
    try {
      const q = await listenOnce().promise;
      await ask(q);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  return (
    <section className="card p-5" aria-labelledby="ask-title">
      <div className="flex items-center gap-3">
        <IconTile icon="mic" size="sm" />
        <h2 id="ask-title" className="text-[1.2rem] font-semibold text-teal">Ask about this label</h2>
      </div>
      <p className="mt-2 text-[0.92rem] text-muted">Answers come only from this medicine&apos;s label.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="ask-input" className="sr-only">Type a question</label>
        <input id="ask-input" className="field flex-1 rounded-full" placeholder="For example: can I take it with food?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        {listen && (
          <button type="button" onClick={onMic} aria-label="Ask by voice" className="glass-teal grid size-12 shrink-0 place-items-center rounded-full">
            <Icon name="mic" />
          </button>
        )}
      </form>
      {status && <p role="status" className="mt-3 font-bold text-teal">{status}</p>}
      {state && (
        <div className="mt-4 rounded-2xl bg-mint-2 p-4">
          <p className="text-[0.9rem] text-muted">You asked: {state.q}</p>
          <p className="mt-1">{state.a}</p>
          <div className="mt-3">
            <ReadAloud id="answer" text={state.a} wide tone="outline" label="Hear the answer" />
          </div>
        </div>
      )}
      {!listen && (
        <div className="mt-3">
          <AmberNote>Spoken questions are not supported in this browser, so please type your question.</AmberNote>
        </div>
      )}
    </section>
  );
}
