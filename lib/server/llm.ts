// Groq (free tier) via its OpenAI-compatible REST API. No SDK needed.
// The model only ever sees a photo of a package or official label text we fetched.

const MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

export class LlmUnavailableError extends Error {
  constructor(
    message: string,
    public rateLimited = false,
  ) {
    super(message);
  }
}

// After a 429 we stop calling the model until Groq says we can retry, to stay inside free limits.
let coolDownUntil = 0;

export function llmAvailable() {
  return Boolean(process.env.GROQ_API_KEY) && Date.now() > coolDownUntil;
}

type Schema = Record<string, unknown>;

/** Parses "20", "13.8s" or "1m2.5s" into seconds. */
function seconds(v: string | null): number | undefined {
  if (!v) return undefined;
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^\d+(\.\d+)?ms$/.test(v)) return parseFloat(v) / 1000;
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+(?:\.\d+)?)s)?$/);
  if (!m || !m[0]) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export async function generateJson<T>(opts: {
  name: string;
  system: string;
  text: string;
  image?: { mimeType: string; base64: string };
  schema: Schema;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<T> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new LlmUnavailableError("No GROQ_API_KEY set");
  if (Date.now() < coolDownUntil) throw new LlmUnavailableError("Rate limited, cooling down", true);

  const content = opts.image
    ? [
        { type: "text", text: opts.text },
        { type: "image_url", image_url: { url: `data:${opts.image.mimeType};base64,${opts.image.base64}` } },
      ]
    : opts.text;

  const send = () => {
    return fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content },
        ],
        temperature: 0,
        max_completion_tokens: opts.maxTokens ?? 1200,
        // Instruct mode: no hidden "thinking", which would cost time and free-tier tokens.
        reasoning_effort: "none",
        // Strict mode guarantees the reply matches the schema.
        response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: opts.schema } },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
    });
  };

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await send();
    } catch (e) {
      throw new LlmUnavailableError(`Model request failed: ${(e as Error).message}`);
    }
    if (res.status !== 429) break;

    // Groq sends retry-after (seconds) or reset times like "13.8s" / "1m2.5s"; fall back to 60s.
    const wait =
      seconds(res.headers.get("retry-after")) ??
      seconds(res.headers.get("x-ratelimit-reset-tokens")) ??
      60;
    const reason = (await res.text()).slice(0, 160);
    // A short wait is worth it: the user gets plain language instead of raw label text.
    if (attempt === 0 && wait <= 10) {
      console.warn(`[groq] busy, retrying in ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000 + 300));
      continue;
    }
    coolDownUntil = Date.now() + Math.min(Math.max(wait, 2), 600) * 1000;
    console.warn(`[groq] rate limited, pausing ${Math.round(wait)}s: ${reason}`);
    throw new LlmUnavailableError("Model rate limit reached", true);
  }

  if (!res.ok) {
    // 413 = request larger than the per-minute token allowance, 401 = bad key, 400 = schema problem.
    const detail = (await res.text()).slice(0, 300);
    console.warn(`[groq] ${res.status} ${detail}`); // e.g. bad key or a model that rejects the schema
    throw new LlmUnavailableError(`Model error ${res.status}`, res.status === 413);
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new LlmUnavailableError("Model returned invalid JSON");
  }
}

// ---------- JSON schemas (strict mode: every field required, no extra fields) ----------
const S = { type: "string" } as const;
const ARR = { type: "array", items: S } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const medicinePhotoSchema = obj({
  readable: { type: "boolean" },
  name: S,
  strength: S,
  form: S,
  confidence: { type: "string", enum: ["high", "medium", "low"] },
});

export const ingredientsPhotoSchema = obj({ readable: { type: "boolean" }, productName: S, ingredients: S });

export const rewriteSchema = obj({
  oneLine: S,
  whatFor: ARR,
  howToTake: ARR,
  sideEffects: { type: "array", items: obj({ text: S, level: { type: "string", enum: ["common", "rare", "listed", "stop"] } }) },
  interactions: { type: "array", items: obj({ title: S, text: S }) },
  getHelp: ARR,
});

export const answerSchema = obj({ found: { type: "boolean" }, answer: S });

// ---------- prompts ----------
export const MEDICINE_PHOTO_PROMPT = `You read photos of medicine packages.
Copy only what is printed on the package. Never guess or fill in from memory.
- name: the active ingredient name(s) exactly as printed (for example "Paracetamol"). If no active ingredient is printed, use the brand name.
- strength: the strength exactly as printed, with its unit (for example "500 mg" or "125 mg/5 ml"). Copy digits carefully; 5 mg and 50 mg are different.
- form: the dosage form as printed (for example "Tablets", "Capsules", "Syrup").
- If a field is not visible, return an empty string for it.
- readable: false if the photo is not a medicine package or is too blurry to read.
- confidence: how sure you are that name and strength are read correctly.`;

export const INGREDIENTS_PHOTO_PROMPT = `You read photos of food, cosmetic or supplement packaging.
Copy the ingredients list exactly as printed, including any "contains" or "may contain" statements. Never guess.
- productName: the product name if visible, otherwise an empty string.
- ingredients: the full ingredients text, comma separated, as printed.
- readable: false if no ingredients list can be read.`;

export const NOT_FOUND = "Not found on the label.";

export function rewritePrompt(language: string) {
  return `You explain official medicine label text in plain language for older adults.
STRICT RULES:
1. Use ONLY the label text the user gives you. Never add facts from memory or general knowledge.
2. If the label does not cover a section, return exactly one item: "${NOT_FOUND}" (for oneLine return that same text).
3. Dosing: only restate what the label says. Keep every number, unit, age group and time gap exactly as written. Never calculate, convert, add up or suggest a dose. Never tell the reader what dose is right for them.
4. Use short sentences and everyday words (reading age about 11). Explain medical words simply.
5. oneLine: one short sentence saying what the medicine is used for, from the label.
6. sideEffects level: "common" or "rare" only if the label states how often; "stop" for signs the label says mean stop using it or ask a doctor; otherwise "listed".
7. interactions: only from drug interaction text, "do not use" text and "ask a doctor or pharmacist before use if you are taking" text. Give each item a short title such as "Blood thinners".
8. getHelp: only signs the label says need urgent help, emergency care, poison control, or stopping right away (for example allergic reactions or overdose).
9. Limits: whatFor up to 4 items, howToTake up to 6, sideEffects up to 6, interactions up to 5, getHelp up to 5.
10. Write all text in ${language}.`;
}

export function answerPrompt(language: string) {
  return `You answer questions about one medicine using ONLY the official label text provided.
- Reply in 1 to 3 short, plain sentences in ${language}.
- If the label text does not answer the question, set found=false and answer exactly: "The label does not say. Please ask your pharmacist."
- Never work out a personal dose and never tell the person to start, stop or change a medicine. For those, quote what the label says and tell them to ask their doctor or pharmacist.
- Never use outside knowledge.`;
}
