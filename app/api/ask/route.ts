import { NextResponse } from "next/server";
import { answerPrompt, answerSchema, generateJson, LlmUnavailableError } from "@/lib/server/llm";

const LANGUAGES: Record<string, string> = { en: "English", es: "Spanish", fr: "French" };

// Answers a spoken or typed question using only the label text the client already has.
export async function POST(req: Request) {
  let body: { question?: string; labelText?: string; medicine?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const question = (body.question ?? "").trim().slice(0, 300);
  const labelText = (body.labelText ?? "").slice(0, 8000); // stays inside the free 8K tokens/minute
  if (!question || !labelText) return NextResponse.json({ error: "Missing question or label text." }, { status: 400 });
  try {
    const out = await generateJson<{ found: boolean; answer: string }>({
      name: "label_answer",
      system: answerPrompt(LANGUAGES[body.language ?? "en"] ?? "English"),
      text: `Medicine: ${(body.medicine ?? "").slice(0, 120)}\n\nOFFICIAL LABEL TEXT:\n${labelText}\n\nQUESTION: ${question}`,
      schema: answerSchema,
      maxTokens: 300,
      timeoutMs: 20000,
    });
    return NextResponse.json(out);
  } catch (e) {
    const rateLimited = e instanceof LlmUnavailableError && e.rateLimited;
    return NextResponse.json({ error: rateLimited ? "rate_limited" : "unavailable" }, { status: rateLimited ? 429 : 503 });
  }
}
