import { NextResponse } from "next/server";
import { findNafdacProducts } from "@/lib/server/nafdac";

export const maxDuration = 30;

const str = (v: string | null, max = 120) => (v ?? "").trim().slice(0, max);

// Finds products registered with NAFDAC that match the confirmed details, so the user can pick theirs.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const q = { name: str(p.get("name")), strength: str(p.get("strength"), 60), form: str(p.get("form"), 60), brand: str(p.get("brand")), nafdac: str(p.get("nafdac"), 20) };
  if (q.name.length < 2 && !q.nafdac) return NextResponse.json({ error: "Please enter the medicine name." }, { status: 400 });
  try {
    return NextResponse.json(await findNafdacProducts(q));
  } catch {
    return NextResponse.json({ error: "The NAFDAC Greenbook is not responding right now." }, { status: 502 });
  }
}
