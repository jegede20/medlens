import { NextResponse } from "next/server";
import {
  generateJson,
  ingredientsPhotoSchema,
  INGREDIENTS_PHOTO_PROMPT,
  LlmUnavailableError,
  MEDICINE_PHOTO_PROMPT,
  medicinePhotoSchema,
} from "@/lib/server/llm";

export const maxDuration = 60;

// Reads a package photo with the vision model. The photo is not stored anywhere.
// Any failure returns a non-200 status so the client falls back to on-device OCR.
export async function POST(req: Request) {
  let body: { image?: string; mimeType?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { image, mimeType = "image/jpeg", kind } = body;
  if (!image || typeof image !== "string" || image.length > 6_000_000 || !/^image\/(jpeg|png|webp)$/.test(mimeType)) {
    return NextResponse.json({ error: "Please send a JPEG, PNG or WebP photo under 4 MB." }, { status: 400 });
  }
  const isMedicine = kind !== "ingredients";
  try {
    const out = await generateJson<Record<string, unknown>>({
      name: isMedicine ? "medicine_package" : "ingredients_list",
      system: isMedicine ? MEDICINE_PHOTO_PROMPT : INGREDIENTS_PHOTO_PROMPT,
      text: isMedicine ? "Read this medicine package." : "Read the ingredients list.",
      image: { mimeType, base64: image },
      schema: isMedicine ? medicinePhotoSchema : ingredientsPhotoSchema,
      maxTokens: isMedicine ? 200 : 800,
      timeoutMs: 25000,
    });
    return NextResponse.json(out);
  } catch (e) {
    const rateLimited = e instanceof LlmUnavailableError && e.rateLimited;
    return NextResponse.json({ error: rateLimited ? "rate_limited" : "unavailable" }, { status: rateLimited ? 429 : 503 });
  }
}
