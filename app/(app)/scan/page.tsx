"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { Icon, type IconName } from "@/components/Icon";
import { InteractionPanel } from "@/components/InteractionPanel";
import { ResultView } from "@/components/ResultView";
import { AmberNote, PharmacistBar, ReadAloud, Spinner, Tag, TopBar } from "@/components/ui";
import { readMedicine } from "@/lib/ocr";
import { getAppData, medicineKey, saveMedicine, useAppData } from "@/lib/store";
import type { ExtractedMedicine, LabelResponse, MedQuery, NafdacProduct } from "@/lib/types";

type Step = "capture" | "confirm" | "pick" | "result";
type Fields = MedQuery;
type Picks = "loading" | "error" | NafdacProduct[];
const EMPTY: Fields = { name: "", strength: "", form: "", brand: "", nafdac: "" };

export default function ScanPage() {
  return (
    <Suspense fallback={<Spinner label="Opening the scanner…" />}>
      <Scan />
    </Suspense>
  );
}

function Scan() {
  const params = useSearchParams();
  const { medicines, settings } = useAppData();
  const nigeria = settings.country === "NG";
  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [found, setFound] = useState<Fields>(EMPTY);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [method, setMethod] = useState<ExtractedMedicine["method"] | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [lookup, setLookup] = useState<LabelResponse | "loading" | null>(null);
  const [picks, setPicks] = useState<Picks>("loading");
  const [product, setProduct] = useState<NafdacProduct | undefined>();
  const [showCheck, setShowCheck] = useState(false);
  const [saved, setSaved] = useState(false);
  const photoRef = useRef<string | null>(null);

  useEffect(() => () => void (photoRef.current && URL.revokeObjectURL(photoRef.current)), []);

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  const toConfirm = (f: Fields, m: ExtractedMedicine["method"], low = false) => {
    setFound(f);
    setFields(f);
    setMethod(m);
    setLowConfidence(low);
    go("confirm");
  };

  const onPhoto = async (file: Blob) => {
    setError(null);
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    photoRef.current = URL.createObjectURL(file);
    setPhoto(photoRef.current);
    setBusy("Reading the box…");
    try {
      const r = await readMedicine(file);
      if (!r.name && !r.strength) setError("We could not read the box clearly. Type the name and strength from the box, or go back and scan the barcode.");
      toConfirm({ name: r.name, strength: r.strength, form: r.form, brand: r.brand ?? "", nafdac: r.nafdac ?? "" }, r.method, r.lowConfidence);
    } catch (e) {
      setError((e as Error).message || "We could not read that photo. Type the details below, or try again.");
      toConfirm(EMPTY, "ocr", true);
    } finally {
      setBusy(null);
    }
  };

  const onBarcode = async (code: string) => {
    setError(null);
    setBusy("Looking up the barcode…");
    try {
      const res = await fetch(`/api/ndc?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We could not find this barcode.");
      setPhoto(null);
      toConfirm({ name: data.name, strength: data.strength, form: data.form, ndc: data.ndc }, "barcode");
    } catch (e) {
      setError(e instanceof TypeError ? "You seem to be offline. Please check your connection." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Nigeria: find the pack in the NAFDAC Greenbook first. An exact NAFDAC number match skips the choice.
  const confirm = async () => {
    if (!nigeria) return showResult();
    setPicks("loading");
    go("pick");
    try {
      const params = new URLSearchParams({ name: fields.name, strength: fields.strength, form: fields.form, brand: fields.brand ?? "", nafdac: fields.nafdac ?? "" });
      const res = await fetch(`/api/nafdac?${params}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { exact: NafdacProduct | null; candidates: NafdacProduct[] };
      if (data.exact) return showResult(data.exact);
      if (!data.candidates.length) return showResult();
      setPicks(data.candidates);
    } catch {
      setPicks("error");
    }
  };

  const showResult = async (product?: NafdacProduct) => {
    setProduct(product);
    setLookup("loading");
    setShowCheck(false);
    setSaved(false);
    go("result");
    const { language, country } = getAppData().settings;
    try {
      const res = await fetch("/api/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, nafdac: product?.nrn ?? fields.nafdac, productId: product?.id, country, language }),
      });
      setLookup((await res.json()) as LabelResponse);
    } catch {
      setLookup({ status: "error", message: "You seem to be offline. Please check your connection and try again." });
    }
  };

  const restart = () => {
    setError(null);
    setLookup(null);
    go("capture");
  };

  if (step === "capture") {
    return (
      <div className="mx-auto max-w-[540px]">
        <TopBar title="Scan a medicine" step={1} backHref="/dashboard" />
        {error && (
          <div className="mb-4">
            <AmberNote icon="warning">{error}</AmberNote>
          </div>
        )}
        <CameraCapture
          heightClass="h-[min(26rem,62vh)]"
          mock={<MockBox />}
          photoHint="Fit the whole front of the box inside the frame"
          showModeSwitch
          initialMode={params.get("mode") === "barcode" ? "barcode" : "photo"}
          autoUpload={params.get("mode") === "upload"}
          busy={busy}
          onPhoto={onPhoto}
          onBarcode={onBarcode}
          tips={
            <ul className="mt-4 grid grid-cols-3 gap-2.5">
              {(
                [
                  ["flash", "Good light"],
                  ["camera", "Hold steady"],
                  ["pill", "Name and strength visible"],
                ] as [IconName, string][]
              ).map(([icon, t]) => (
                <li key={t} className="flex flex-col items-center gap-1.5 rounded-2xl bg-mint-1 px-2 py-3 text-center text-[0.85rem] font-bold leading-tight text-teal">
                  <Icon name={icon} /> {t}
                </li>
              ))}
            </ul>
          }
        />
        <div className="mt-6">
          <AmberNote>MedLens explains labels. Ask your doctor or pharmacist for any medical decision.</AmberNote>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    const fieldDefs: { key: keyof Fields; label: string; placeholder: string; warn?: boolean; optional?: boolean }[] = [
      { key: "name", label: "Medicine name", placeholder: "For example: Paracetamol" },
      ...(nigeria ? [{ key: "brand" as const, label: "Brand name (if shown)", placeholder: "For example: Emzor Paracetamol", optional: true }] : []),
      { key: "strength", label: "Strength", placeholder: "For example: 500 mg", warn: true },
      { key: "form", label: "Form", placeholder: "For example: Tablets" },
      ...(nigeria ? [{ key: "nafdac" as const, label: "NAFDAC Reg. No. (if shown)", placeholder: "For example: 04-0411", optional: true }] : []),
    ];
    const spoken = fieldDefs.map((f) => `${f.label}: ${fields[f.key] || "not filled in"}.`).join(" ");
    return (
      <div className="mx-auto max-w-[540px]">
        <TopBar title="Confirm details" step={2} onBack={restart} />
        <div className="flex items-center gap-4">
          <div className="grid h-[6.5rem] w-[5.25rem] shrink-0 place-items-center overflow-hidden rounded-2xl bg-teal-deep text-white">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Your photo of the box" className="size-full object-cover" />
            ) : (
              <Icon name="barcode" size={32} />
            )}
          </div>
          <div>
            <p className="font-bold">{photo ? "Your photo" : "From the barcode"}</p>
            <button type="button" onClick={restart} className="font-bold text-teal underline">Retake</button>
          </div>
        </div>

        <h2 className="mt-6 text-[clamp(1.5rem,2vw+1rem,1.9rem)] font-bold leading-tight text-teal">Is this the right medicine?</h2>
        <p className="mt-1 text-muted">Check the name and strength against your box. Tap any field to fix it.</p>

        {error && (
          <div className="mt-4">
            <AmberNote icon="warning">{error}</AmberNote>
          </div>
        )}
        {!error && (method === "ocr" || lowConfidence) && (
          <div className="mt-4">
            <AmberNote icon="warning">We are not fully sure about this reading. Please compare each field with your box carefully.</AmberNote>
          </div>
        )}

        <form
          className="card mt-5 space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (fields.name.trim().length >= 2) confirm();
          }}
        >
          {fieldDefs.map((f) => {
            const original = found[f.key] ?? "";
            const value = fields[f.key] ?? "";
            const tag = original && value === original ? "Found on box" : value ? "Edited by you" : f.optional ? "Optional" : "Please type it";
            return (
              <div key={f.key}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor={`f-${f.key}`} className="text-[0.9rem] font-bold text-muted">{f.label}</label>
                  <Tag tone={tag === "Found on box" ? "mint" : tag === "Please type it" ? "amber" : "grey"}>{method === "barcode" && tag === "Found on box" ? "From barcode" : tag}</Tag>
                </div>
                <div className="relative">
                  <input
                    id={`f-${f.key}`}
                    value={value}
                    placeholder={f.placeholder}
                    onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                    className={`field pr-12 text-[1.15rem] font-bold ${f.warn ? "border-amber bg-[#FFF8EA]" : ""}`}
                    autoComplete="off"
                  />
                  <Icon name="pencil" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
                </div>
              </div>
            );
          })}
          <AmberNote icon="warning">Double-check the strength. A small misread, like 5 mg and 50 mg, matters.</AmberNote>
          <button type="submit" hidden />
        </form>

        <div className="mt-5 flex flex-col gap-3">
          <ReadAloud id="confirm" text={spoken} label="Read these details aloud" wide />
          <button type="button" onClick={confirm} disabled={fields.name.trim().length < 2} className="btn glass-teal min-h-14 text-[1.1rem]">
            <Icon name="check" /> Yes, this is right
          </button>
          <button type="button" onClick={restart} className="btn btn-outline min-h-14">No, scan again</button>
        </div>
        <div className="mt-6">
          <AmberNote>MedLens explains labels. Ask your doctor or pharmacist for any medical decision.</AmberNote>
        </div>
      </div>
    );
  }

  if (step === "pick") {
    return (
      <div className="mx-auto max-w-[540px]">
        <TopBar title="Find your product" step={2} onBack={() => go("confirm")} />
        {picks === "loading" ? (
          <Spinner label="Checking the NAFDAC Greenbook…" />
        ) : picks === "error" ? (
          <section className="card p-6 text-center">
            <h2 className="text-[1.3rem] font-bold text-teal">We could not reach the NAFDAC Greenbook</h2>
            <p className="mt-2 text-muted">You can try again, or see the US label for the same active ingredient instead.</p>
            <div className="mt-5 flex flex-col gap-3">
              <button type="button" onClick={confirm} className="btn glass-teal">Try again</button>
              <button type="button" onClick={() => showResult()} className="btn btn-outline">Use the US label</button>
            </div>
          </section>
        ) : (
          <>
            <h2 className="text-[clamp(1.5rem,2vw+1rem,1.9rem)] font-bold leading-tight text-teal">Which one is your pack?</h2>
            <p className="mt-1 text-muted">These are registered with NAFDAC. Match the name, company and strength on your pack.</p>
            <ul className="mt-5 space-y-3">
              {picks.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => showResult(p)} className="card flex w-full items-start gap-3 p-4 text-left transition hover:border-teal">
                    <span className="flex-1">
                      <span className="block text-[1.1rem] font-bold leading-snug text-teal">{p.name}</span>
                      <span className="block">{[p.strength, p.form].filter(Boolean).join(" · ")}</span>
                      <span className="block text-[0.9rem] text-muted">{p.applicant}</span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        <Tag tone="grey">Reg. No. {p.nrn}</Tag>
                        <Tag tone={p.status === "Active" ? "mint" : "amber"}>{p.status === "Active" ? "Registered" : `Registration ${p.status.toLowerCase()}`}</Tag>
                        {!p.hasSmpc && <Tag tone="grey">No leaflet on file</Tag>}
                      </span>
                    </span>
                    <Icon name="chevron" className="mt-1 text-teal" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => showResult()} className="btn btn-outline mt-4 min-h-14 w-full">My pack is not listed</button>
          </>
        )}
        <div className="mt-6">
          <AmberNote>MedLens explains labels. Ask your doctor or pharmacist for any medical decision.</AmberNote>
        </div>
      </div>
    );
  }

  // Result
  const result = lookup && lookup !== "loading" && lookup.status === "ok" ? lookup.result : null;
  const others = result ? medicines.map((m) => m.result).filter((r) => medicineKey(r) !== medicineKey(result)) : [];
  return (
    <div className="mx-auto max-w-[540px]">
      <TopBar title="Your result" step={3} onBack={() => go("confirm")} />
      {lookup === "loading" || !lookup ? (
        <>
          <Spinner label="Finding the official label…" />
          <PharmacistBar />
        </>
      ) : lookup.status !== "ok" ? (
        <div className="space-y-4">
          <section className="card p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-caution text-[#8a5a00]">
              <Icon name="info" size={28} />
            </span>
            <h2 className="mt-3 text-[1.4rem] font-bold text-teal">{lookup.status === "not_found" ? "Label not found" : "Something went wrong"}</h2>
            <p className="mt-2 text-muted">{lookup.message}</p>
            <div className="mt-5 flex flex-col gap-3">
              {lookup.status === "error" && (
                <button type="button" onClick={() => showResult(product)} className="btn glass-teal">Try again</button>
              )}
              <button type="button" onClick={() => go("confirm")} className="btn btn-outline">
                <Icon name="pencil" /> Edit the details
              </button>
              <button type="button" onClick={restart} className="btn btn-outline">Scan again</button>
            </div>
          </section>
          <PharmacistBar text="Ask your pharmacist about this medicine. They can read the full label with you." />
        </div>
      ) : (
        <ResultView result={lookup.result} notice={lookup.notice}>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setShowCheck((v) => !v)} aria-expanded={showCheck} className="btn glass-teal min-h-14">
              <Icon name="shield" /> Check against my other medicines
            </button>
            {showCheck && result && <InteractionPanel target={result} others={others} />}
            <button
              type="button"
              onClick={() => {
                saveMedicine(lookup.result);
                setSaved(true);
              }}
              disabled={saved}
              className="btn btn-outline min-h-14"
            >
              <Icon name={saved ? "check" : "plus"} /> {saved ? "Saved to My medicines" : "Save to My medicines"}
            </button>
          </div>
        </ResultView>
      )}
    </div>
  );
}

function MockBox() {
  return (
    <div className="w-[62%] max-w-[260px] -rotate-3 rounded-2xl bg-[#F4F7F5] p-5 shadow-2xl" aria-hidden="true">
      <span className="block h-4 w-3/4 rounded-full bg-teal" />
      <span className="mt-2.5 block h-3.5 w-2/5 rounded-full bg-amber" />
      <span className="mt-5 block h-2 w-full rounded-full bg-mint-5" />
      <span className="mt-2 block h-2 w-5/6 rounded-full bg-mint-5" />
      <span className="mt-2 block h-2 w-2/3 rounded-full bg-mint-5" />
      <div className="mt-5 flex items-center justify-between">
        <span className="h-6 w-16 rounded-md bg-mint-3" />
        <span className="h-6 w-6 rounded-full bg-teal/80" />
      </div>
    </div>
  );
}
