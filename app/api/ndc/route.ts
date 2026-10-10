import { NextResponse } from "next/server";
import { ndcCandidates } from "@/lib/server/label";

// Looks up a US drug barcode / NDC number and returns name, strength and form for the confirm step.
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  const candidates = ndcCandidates(code);
  if (!candidates.length) {
    return NextResponse.json(
      { error: "This does not look like a US medicine barcode. Take a photo of the box instead." },
      { status: 400 },
    );
  }
  const search = candidates.flatMap((n) => [`packaging.package_ndc:"${n}"`, `product_ndc:"${n.split("-").slice(0, 2).join("-")}"`]).join(" ");
  const key = process.env.OPENFDA_API_KEY ? `&api_key=${process.env.OPENFDA_API_KEY}` : "";
  try {
    const res = await fetch(`https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(search)}&limit=1${key}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (res.status === 404) {
      return NextResponse.json({ error: "We could not find this barcode. Take a photo of the box, or type the name." }, { status: 404 });
    }
    if (!res.ok) throw new Error(`openFDA ${res.status}`);
    type Ndc = { packaging?: { package_ndc: string }[]; generic_name?: string; brand_name?: string; dosage_form?: string; active_ingredients?: { name: string; strength: string }[] };
    const item = ((await res.json()) as { results?: Ndc[] }).results?.[0];
    if (!item) return NextResponse.json({ error: "We could not find this barcode." }, { status: 404 });
    const tidy = (s = "") => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    const strength = (item.active_ingredients ?? []).map((a) => a.strength.replace(/\/1$/, "").replace(/\bMG\b/i, "mg")).join(" / ");
    return NextResponse.json({
      name: tidy(item.generic_name),
      strength,
      form: tidy(item.dosage_form?.split(",")[0]),
      ndc: item.packaging?.find((p) => candidates.includes(p.package_ndc))?.package_ndc ?? candidates[0],
    });
  } catch {
    return NextResponse.json({ error: "The barcode service is not responding. Please try again." }, { status: 502 });
  }
}
