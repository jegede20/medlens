// Label result cache keyed by drug name. Uses Supabase (free tier) via its REST API when
// configured, otherwise a small in-memory cache. Only public label summaries are stored.

import type { MedResult } from "../types";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // labels change rarely; refresh monthly
const memory = new Map<string, { data: MedResult; at: number }>();

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: `${url.replace(/\/$/, "")}/rest/v1/label_cache`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

export function cacheKey(parts: string[]) {
  return "v1|" + parts.map((p) => p.toLowerCase().replace(/\s+/g, " ").trim()).join("|");
}

export async function cacheGet(key: string): Promise<MedResult | null> {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const sb = supabase();
  if (!sb) return null;
  try {
    const res = await fetch(`${sb.url}?key=eq.${encodeURIComponent(key)}&select=data,created_at`, {
      headers: sb.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { data: MedResult; created_at: string }[];
    const row = rows[0];
    if (!row || Date.now() - new Date(row.created_at).getTime() > TTL_MS) return null;
    memory.set(key, { data: row.data, at: Date.now() });
    return row.data;
  } catch {
    return null; // cache problems must never break a lookup
  }
}

export async function cacheSet(key: string, data: MedResult) {
  if (memory.size > 300) memory.delete(memory.keys().next().value as string);
  memory.set(key, { data, at: Date.now() });

  const sb = supabase();
  if (!sb) return;
  try {
    await fetch(sb.url, {
      method: "POST",
      headers: { ...sb.headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key, data, created_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* ignore cache write errors */
  }
}
