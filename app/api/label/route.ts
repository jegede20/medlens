import { NextResponse } from "next/server";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/cache";
import { lookupLabel } from "@/lib/server/label";
import type { LabelResponse, MedQuery } from "@/lib/types";

export const maxDuration = 60;

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<LabelResponse>({ status: "error", message: "Invalid request." }, { status: 400 });
  }
  const query: MedQuery = { name: str(body.name), strength: str(body.strength, 60), form: str(body.form, 60) };
  const ndc = str(body.ndc, 20);
  if (ndc) query.ndc = ndc;
  const lang = ["en", "es", "fr"].includes(str(body.language)) ? str(body.language) : "en";
  if (query.name.length < 2) {
    return NextResponse.json<LabelResponse>({ status: "error", message: "Please enter the medicine name." }, { status: 400 });
  }

  // Cache by drug name so repeated lookups do not spend free-tier model quota.
  const key = cacheKey([lang, query.name, query.strength, query.form]);
  const cached = await cacheGet(key);
  if (cached) return NextResponse.json<LabelResponse>({ status: "ok", result: { ...cached, query }, cached: true });

  try {
    const out = await lookupLabel(query, lang);
    // Only cache plain-language results; label-wording fallbacks get retried later.
    if (out.status === "ok" && out.result.plainLanguage) await cacheSet(key, out.result);
    return NextResponse.json<LabelResponse>(out);
  } catch (e) {
    console.error("label lookup failed", e);
    return NextResponse.json<LabelResponse>(
      { status: "error", message: "We could not reach the label service. Please check your connection and try again." },
      { status: 502 },
    );
  }
}
