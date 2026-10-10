# MedLens

Free PWA that reads medicine boxes and explains the official label in plain words, with a voice mode for older users,
plus a Product Checker that flags ingredients clashing with your allergies and goals. Every result sends you to a
doctor or pharmacist for medical decisions.

## Run

```bash
npm install
cp .env.example .env.local   # optional, all keys are free-tier and optional
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
npm run lint && npm run typecheck
```

Works with **no keys at all**: photos are read on-device with Tesseract.js, results show the label's own wording, and
label results are cached in memory. Add keys to improve it:

| Variable | Free source | What it adds |
| --- | --- | --- |
| `GROQ_API_KEY` (+ optional `GROQ_MODEL`) | console.groq.com/keys | Vision reading of curved/messy boxes, plain-language rewrites, spoken questions |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | supabase.com | Shared label cache by drug name (run `supabase/schema.sql` once) |
| `OPENFDA_API_KEY` | open.fda.gov | Higher openFDA daily limit |

Deploy: push to GitHub, import into Vercel (free), add the same env vars.

## How it works

`photo → /api/extract (Groq vision, else Tesseract in the browser) → confirm step (user must confirm name/strength)
→ /api/label: cache → RxNorm normalize → openFDA label (DailyMed fallback) → Groq rewrite using only that label text → result`

- The model only sees the fetched label text and must answer "Not found on the label." for gaps. Every number in the
  rewritten dosing has to appear in the label's dosing text, otherwise the label's own words are shown.
- Rate limits: Groq's free tier for `qwen/qwen3.8-27b` is 30 requests/min, 1,000/day and 8,000 tokens/min. A photo
  costs ~2K tokens and a rewrite ~4K, so expect about one full new scan per minute; cached drugs cost nothing.
  A 429 pauses model calls for Groq's `retry-after` time and users get the label's own words meanwhile. Only
  plain-language results are cached (30 days).
- Barcodes: US drug UPC/NDC via openFDA (`/api/ndc`), products via Open Food Facts. Uses the browser's BarcodeDetector,
  with typing the number as the fallback.
- Interactions come only from label warning text (`lib/interactions.ts`) and are always marked "not a complete check".
- Allergies, goals, saved medicines and settings live in localStorage on the device (`lib/store.ts`). Ingredient
  matching (`lib/ingredients.ts`) runs on the device; nothing personal is sent to a server.
