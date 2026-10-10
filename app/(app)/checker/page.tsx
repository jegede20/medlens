"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { Icon } from "@/components/Icon";
import { ChipList } from "@/components/ProfileEditor";
import { AmberNote, PharmacistBar, ReadAloud, Tag, TopBar } from "@/components/ui";
import { checkIngredients } from "@/lib/ingredients";
import { readIngredients } from "@/lib/ocr";
import { useAppData } from "@/lib/store";

interface Product {
  name: string;
  ingredients: string;
  photo: string | null;
  extra?: Parameters<typeof checkIngredients>[2];
}

const BAR_TEXT = "Ask your doctor or pharmacist about any serious allergy.";

export default function CheckerPage() {
  const { profile } = useAppData();
  const [product, setProduct] = useState<Product | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const photoRef = useRef<string | null>(null);

  const show = (p: Product, edit = false) => {
    setProduct(p);
    setEditing(edit);
    window.scrollTo({ top: 0 });
  };

  const onPhoto = async (file: Blob) => {
    setError(null);
    setBusy("Reading the ingredients…");
    try {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current);
      photoRef.current = URL.createObjectURL(file);
      const r = await readIngredients(file);
      if (r.ingredients.trim().length < 3) {
        setError("We could not find an ingredients list in that photo. Try again closer to the list, or type it in.");
        return;
      }
      show({ name: r.productName || "Your product", ingredients: r.ingredients, photo: photoRef.current }, r.method === "ocr");
    } catch (e) {
      setError((e as Error).message || "We could not read that photo. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onBarcode = async (code: string) => {
    setError(null);
    setBusy("Looking up the product…");
    try {
      // Open Food Facts is free and open. Only the barcode number is sent, never your profile.
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,ingredients_text,ingredients_text_en,allergens_tags,traces_tags,nutriments`,
      );
      const data = res.ok ? await res.json() : null;
      const p = data?.product;
      const ingredients: string = p?.ingredients_text_en || p?.ingredients_text || "";
      if (!p || !ingredients) {
        setError("We could not find the ingredients for this barcode. Take a photo of the ingredients list instead.");
        return;
      }
      show({
        name: [p.brands?.split(",")[0], p.product_name].filter(Boolean).join(" ") || "Your product",
        ingredients,
        photo: null,
        extra: {
          allergenTags: p.allergens_tags,
          traceTags: p.traces_tags,
          sugars100g: p.nutriments?.sugars_100g,
          salt100g: p.nutriments?.salt_100g,
          fat100g: p.nutriments?.fat_100g,
        },
      });
    } catch {
      setError("The product database is not responding. Check your connection, or take a photo of the ingredients list.");
    } finally {
      setBusy(null);
    }
  };

  if (!product) {
    return (
      <div className="mx-auto max-w-[540px]">
        <TopBar title="Product checker" subtitle="Check ingredients" backHref="/dashboard" />
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[1.15rem] font-semibold text-teal">Checking for</h2>
            <Link href="/settings#profile" className="font-bold text-teal underline">Edit</Link>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {profile.allergies.length > 0 && <ChipList items={profile.allergies} tone="red" />}
            {profile.goals.length > 0 && <ChipList items={profile.goals} tone="amber" />}
            <Link href="/settings#profile" className="inline-flex min-h-10 items-center gap-1 rounded-full border-2 border-dashed border-mint-5 px-3.5 font-bold text-teal">
              <Icon name="plus" size={16} /> Add
            </Link>
          </div>
          <p className="mt-3 text-[0.88rem] text-muted">
            {profile.allergies.length || profile.goals.length
              ? "Your allergies and goals stay on this device."
              : "Add your allergies and goals so MedLens knows what to look for. They stay on this device."}
          </p>
        </section>

        {error && (
          <div className="mt-4 space-y-2">
            <AmberNote icon="warning">{error}</AmberNote>
          </div>
        )}

        <div className="mt-5">
          <CameraCapture heightClass="h-[min(20.5rem,44vh)]" mock={<MockPanel />} photoHint="Point at the ingredients list" busy={busy} onPhoto={onPhoto} onBarcode={onBarcode} />
        </div>
        <button type="button" onClick={() => show({ name: "Your product", ingredients: "", photo: null }, true)} className="mt-5 w-full font-bold text-teal underline">
          Type the ingredients instead
        </button>
        {/* Not sticky here, so it never covers the camera controls. Result screens keep the sticky bar. */}
        <div className="mt-5">
          <PharmacistBar text={BAR_TEXT} sticky={false} />
        </div>
      </div>
    );
  }

  // Matching runs on this device only.
  const result = checkIngredients(product.ingredients, profile, product.extra);
  const verdict = {
    bad: { title: "Not a good match", card: "border-danger-line bg-danger-tint text-danger-ink", dot: "bg-danger", icon: "x" as const },
    caution: { title: "Check before you buy", card: "border-amber-soft bg-caution text-caution-ink", dot: "bg-amber", icon: "warning" as const },
    good: { title: "Looks like a good match", card: "border-mint-5 bg-mint-1 text-ink", dot: "bg-teal", icon: "check" as const },
  }[result.verdict];
  const spoken = `${verdict.title}. ${result.summary} ${result.flags.map((f) => `${f.ingredient}: ${f.reason}`).join(" ")} Always read the pack too.`;

  return (
    <div className="mx-auto max-w-[540px] space-y-4">
      <TopBar title="Product result" subtitle="Checked against your profile" onBack={() => setProduct(null)} />

      <div className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-teal-deep text-white">
          {product.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.photo} alt="Your photo of the product" className="size-full object-cover" />
          ) : (
            <Icon name="barcode" size={28} />
          )}
        </div>
        <div>
          <h2 className="text-[1.3rem] font-bold leading-tight text-teal">{product.name}</h2>
          <p className="text-muted">{result.ingredients.length} ingredients read</p>
        </div>
      </div>

      {result.ingredients.length > 0 && (
        <section className={`relative overflow-hidden rounded-[26px] border p-5 ${verdict.card}`} aria-live="polite">
          <span className={`absolute -right-10 -top-10 size-32 rounded-full opacity-15 ${verdict.dot}`} aria-hidden="true" />
          <div className="relative flex items-start gap-4">
            <span className={`grid size-12 shrink-0 place-items-center rounded-full text-white ${verdict.dot}`}>
              <Icon name={verdict.icon} size={26} strokeWidth={2.6} />
            </span>
            <div>
              <h3 className="text-[1.35rem] font-bold leading-tight">{verdict.title}</h3>
              <p className="mt-1">{result.summary}</p>
            </div>
          </div>
          <ReadAloud id="verdict" text={spoken} wide className="relative mt-4" />
        </section>
      )}

      {result.flags.length > 0 && (
        <section aria-labelledby="watch-title" className="space-y-2.5">
          <h3 id="watch-title" className="text-[1.2rem] font-semibold text-teal">Ingredients to watch</h3>
          {result.flags.map((f, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold capitalize">{f.ingredient}</p>
                <Tag tone={f.kind === "allergy" ? "red" : "amber"}>{f.kind === "allergy" ? (f.mayContain ? "May contain" : "Allergy") : "Goal"}</Tag>
              </div>
              <p className="mt-1 text-muted">{f.reason}</p>
            </div>
          ))}
        </section>
      )}

      {result.safe.length > 0 && (
        <section className="flex gap-3 rounded-[22px] border border-mint-5 bg-mint-1 p-4">
          <Icon name="check" className="mt-0.5 text-teal" />
          <div>
            <p className="font-bold text-teal">No clash found</p>
            <p className="text-ink">{result.safe.join(", ")}</p>
          </div>
        </section>
      )}

      <section className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[1.05rem] font-semibold text-teal">Ingredients we read</h3>
          <button type="button" onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1 font-bold text-teal underline">
            <Icon name="pencil" size={18} /> {editing ? "Done" : "Fix"}
          </button>
        </div>
        {editing ? (
          <>
            <label htmlFor="ingredients" className="sr-only">Ingredients list</label>
            <textarea
              id="ingredients"
              rows={5}
              value={product.ingredients}
              onChange={(e) => setProduct({ ...product, ingredients: e.target.value })}
              placeholder="Type or paste the ingredients, separated by commas"
              className="field mt-2"
            />
            <p className="mt-1 text-[0.88rem] text-muted">Compare with the pack and fix any words we misread. The check updates as you type.</p>
          </>
        ) : (
          <p className="mt-1 text-[0.92rem] text-muted">{product.ingredients || "Nothing yet."}</p>
        )}
      </section>

      <p className="rounded-2xl bg-[#F1F3F2] px-4 py-3 text-[0.9rem] text-muted">
        Ingredient lists can change and may miss &quot;may contain&quot; warnings. Always read the pack too.
      </p>

      <button type="button" onClick={() => setProduct(null)} className="btn btn-outline w-full min-h-14">
        <Icon name="scan" /> Scan another product
      </button>

      <PharmacistBar text={BAR_TEXT} />
    </div>
  );
}

function MockPanel() {
  return (
    <div className="w-[66%] max-w-[270px] rotate-2 rounded-2xl bg-[#F4F7F5] p-5 shadow-2xl" aria-hidden="true">
      <span className="block text-[0.7rem] font-bold tracking-[0.15em] text-teal">INGREDIENTS</span>
      {["w-full", "w-11/12", "w-4/5", "w-full", "w-3/5"].map((w, i) => (
        <span key={i} className={`mt-2 block h-2 rounded-full ${i === 1 ? "bg-amber" : "bg-mint-5"} ${w}`} />
      ))}
      <span className="mt-4 block h-2 w-1/2 rounded-full bg-danger/40" />
    </div>
  );
}
