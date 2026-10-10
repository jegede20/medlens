"use client";

// On-device storage for settings, allergies, goals and saved medicines.
// Everything lives in localStorage on this device and is never sent to a server.

import { useSyncExternalStore } from "react";
import type { AppData, MedResult, Profile, SavedMedicine, Settings } from "./types";

export const STORAGE_KEY = "medlens:v1";

export const DEFAULT_DATA: AppData = {
  settings: { textSize: 2, voiceMode: true, highContrast: false, voiceRate: 0.9, language: "en" },
  profile: { allergies: [], goals: [] },
  medicines: [],
};

let data: AppData = DEFAULT_DATA;
let loaded = false;
const listeners = new Set<() => void>();

function load(): AppData {
  if (loaded || typeof window === "undefined") return data;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppData>;
      data = {
        settings: { ...DEFAULT_DATA.settings, ...parsed.settings },
        profile: { ...DEFAULT_DATA.profile, ...parsed.profile },
        medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
      };
    }
  } catch {
    data = DEFAULT_DATA;
  }
  return data;
}

function commit(next: AppData) {
  data = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private mode). Keep working in memory.
  }
  applyDocumentSettings(next.settings);
  listeners.forEach((l) => l());
}

/** Mirrors text size / contrast onto <html> so CSS can react. */
export function applyDocumentSettings(s: Settings) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.size = String(s.textSize);
  document.documentElement.dataset.contrast = s.highContrast ? "high" : "normal";
  document.documentElement.lang = s.language;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      loaded = false;
      load();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, load, () => DEFAULT_DATA);
}

export function getAppData(): AppData {
  return load();
}

export function updateSettings(patch: Partial<Settings>) {
  const cur = load();
  commit({ ...cur, settings: { ...cur.settings, ...patch } });
}

export function updateProfile(patch: Partial<Profile>) {
  const cur = load();
  commit({ ...cur, profile: { ...cur.profile, ...patch } });
}

export function medicineKey(r: MedResult) {
  return `${r.query.name}|${r.query.strength}|${r.query.form}`.toLowerCase().replace(/\s+/g, " ").trim();
}

export function saveMedicine(result: MedResult): SavedMedicine {
  const cur = load();
  const key = medicineKey(result);
  const existing = cur.medicines.find((m) => medicineKey(m.result) === key);
  const entry: SavedMedicine = { id: existing?.id ?? crypto.randomUUID(), savedAt: Date.now(), result };
  commit({ ...cur, medicines: [entry, ...cur.medicines.filter((m) => m.id !== entry.id)] });
  return entry;
}

export function removeMedicine(id: string) {
  const cur = load();
  commit({ ...cur, medicines: cur.medicines.filter((m) => m.id !== id) });
}

/** Wipes everything MedLens stored on this device. */
export async function clearAllData() {
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    // Includes the OCR language data Tesseract keeps in IndexedDB.
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(dbs.map((db) => db.name && indexedDB.deleteDatabase(db.name)));
  } catch {
    /* ignore */
  }
  commit({ ...DEFAULT_DATA, settings: { ...DEFAULT_DATA.settings } });
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
