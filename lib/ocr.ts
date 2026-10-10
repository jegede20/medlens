"use client";

// Reads a photo: first the free vision model (better with curved or messy labels),
// then on-device Tesseract.js as a fallback when the model is unavailable or rate limited.

import type { ExtractedIngredients, ExtractedMedicine } from "./types";

const FORMS = [
  "tablets", "tablet", "caplets", "capsules", "capsule", "softgels", "gelcaps", "syrup", "suspension", "solution",
  "cream", "ointment", "gel", "drops", "spray", "inhaler", "injection", "lozenges", "patch", "powder", "suppositories", "elixir",
];
const STRENGTH_RE = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|μg|g|ml|iu|units?|%)(?:\s*\/\s*(\d+(?:[.,]\d+)?)\s*(ml|g))?/i;

/** Downscales a photo to keep uploads small and fast. */
export async function prepareImage(file: Blob, maxSide = 1600): Promise<{ canvas: HTMLCanvasElement; base64: string }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("We could not open that photo. Please try a JPEG or PNG image.");
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  return { canvas, base64 };
}

async function vision<T>(base64: string, kind: "medicine" | "ingredients"): Promise<T | null> {
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64, mimeType: "image/jpeg", kind }),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function tesseract(canvas: HTMLCanvasElement) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
    return { text: data.text ?? "", lines };
  } finally {
    await worker.terminate();
  }
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export async function readMedicine(file: Blob): Promise<ExtractedMedicine> {
  const { canvas, base64 } = await prepareImage(file);
  type V = { readable: boolean; name: string; strength: string; form: string; confidence: string };
  const v = await vision<V>(base64, "medicine");
  if (v && v.readable && (v.name || v.strength)) {
    return { name: v.name, strength: v.strength, form: v.form, method: "vision", lowConfidence: v.confidence !== "high" };
  }

  const { text, lines } = await tesseract(canvas);
  const strength = text.match(STRENGTH_RE);
  const lower = text.toLowerCase();
  const form = FORMS.find((f) => new RegExp(`\\b${f}\\b`).test(lower)) ?? "";
  // The medicine name is usually the biggest text on the box.
  const candidates = lines
    .map((l) => ({ text: l.text.replace(/[^A-Za-z\s-]/g, " ").replace(/\s+/g, " ").trim(), h: l.bbox.y1 - l.bbox.y0, conf: l.confidence }))
    .filter((l) => l.text.length >= 4 && l.conf > 40 && !/tablet|capsule|keep|reach|children|pharmac|store/i.test(l.text))
    .sort((a, b) => b.h - a.h);
  const name = candidates[0]?.text.split(" ").slice(0, 3).join(" ") ?? "";
  return {
    name: name ? titleCase(name) : "",
    strength: strength ? strength[0].replace(/\s*(mg|mcg|ml|g|iu)/i, (m) => " " + m.trim().toLowerCase()) : "",
    form: form ? titleCase(form) : "",
    method: "ocr",
    lowConfidence: true,
  };
}

export async function readIngredients(file: Blob): Promise<ExtractedIngredients> {
  const { canvas, base64 } = await prepareImage(file);
  const v = await vision<{ readable: boolean; productName: string; ingredients: string }>(base64, "ingredients");
  if (v && v.readable && v.ingredients) return { productName: v.productName, ingredients: v.ingredients, method: "vision" };

  const { text } = await tesseract(canvas);
  const flat = text.replace(/\s+/g, " ");
  const idx = flat.toLowerCase().indexOf("ingredients");
  return { productName: "", ingredients: (idx >= 0 ? flat.slice(idx + 11) : flat).replace(/^[\s:.-]+/, "").trim(), method: "ocr" };
}

/** Uses the browser's built-in barcode reader when available (Chrome on Android, Edge, some others). */
export function barcodeSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

type Detector = { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> };

export function createBarcodeDetector(): Detector | null {
  if (!barcodeSupported()) return null;
  const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  try {
    return new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "data_matrix", "qr_code"] });
  } catch {
    return null;
  }
}

/** Pulls a GTIN/NDC out of a GS1 DataMatrix ("(01)0030...") or returns the raw digits. */
export function barcodeDigits(raw: string) {
  const gs1 = raw.match(/^(?:\(01\)|01)(\d{14})/);
  if (gs1) return gs1[1].replace(/^0+(?=\d{12,13}$)/, "");
  return raw.replace(/\D/g, "");
}
