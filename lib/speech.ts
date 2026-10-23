"use client";

// Thin wrapper around the Web Speech API with graceful fallbacks.

import { useSyncExternalStore } from "react";
import { getAppData } from "./store";

const LANG_TAGS: Record<string, string> = { en: "en-US", es: "es-ES", fr: "fr-FR" };

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function canListen() {
  return recognitionCtor() !== null;
}

// ---- who is speaking right now (so each button can show its own state) ----
let speakingId: string | null = null;
const listeners = new Set<() => void>();
function setSpeaking(id: string | null) {
  speakingId = id;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useSpeakingId() {
  return useSyncExternalStore(subscribe, () => speakingId, () => null);
}

const noop = () => () => {};
export function useSpeechSupport() {
  const speak = useSyncExternalStore(noop, canSpeak, () => false);
  const listen = useSyncExternalStore(noop, canListen, () => false);
  return { speak, listen };
}

function pickVoice(tag: string) {
  const voices = window.speechSynthesis.getVoices();
  const base = tag.slice(0, 2);
  return (
    voices.find((v) => v.lang === tag && v.localService) ??
    voices.find((v) => v.lang === tag) ??
    voices.find((v) => v.lang.startsWith(base))
  );
}

/** Splits long text so Chrome does not cut speech off after ~15 seconds. */
function chunk(text: string) {
  const parts = text.replace(/\s+/g, " ").match(/[^.!?;:]+[.!?;:]*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > 180 && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** `lang` is the language the text is written in (results shown in label wording are English). */
export function speak(text: string, id = "default", rate?: number, lang?: string) {
  if (!canSpeak() || !text.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const { settings } = getAppData();
  const tag = LANG_TAGS[lang ?? settings.language] ?? "en-US";
  const voice = pickVoice(tag);
  const pieces = chunk(text);
  setSpeaking(id);
  pieces.forEach((piece, i) => {
    const u = new SpeechSynthesisUtterance(piece);
    u.lang = tag;
    if (voice) u.voice = voice;
    u.rate = rate ?? settings.voiceRate;
    if (i === pieces.length - 1) {
      u.onend = () => speakingId === id && setSpeaking(null);
    }
    u.onerror = () => speakingId === id && setSpeaking(null);
    synth.speak(u);
  });
  return true;
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
  setSpeaking(null);
}

/** Listens for one spoken phrase. Rejects with a friendly message on failure. */
export function listenOnce(): { promise: Promise<string>; cancel: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    return {
      promise: Promise.reject(new Error("Spoken questions are not supported in this browser. Try Chrome, Edge or Safari, or type your question.")),
      cancel: () => {},
    };
  }
  stopSpeaking();
  const rec = new Ctor();
  rec.lang = LANG_TAGS[getAppData().settings.language] ?? "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  const promise = new Promise<string>((resolve, reject) => {
    let done = false;
    rec.onresult = (e) => {
      done = true;
      resolve(e.results[0]?.[0]?.transcript ?? "");
    };
    rec.onerror = (e) => {
      done = true;
      const msg =
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access was blocked. Allow the microphone in your browser settings, or type your question."
          : e.error === "no-speech"
            ? "I did not hear anything. Please try again."
            : "Sorry, listening did not work. Please try again or type your question.";
      reject(new Error(msg));
    };
    rec.onend = () => {
      if (!done) reject(new Error("I did not hear anything. Please try again."));
    };
  });
  try {
    rec.start();
  } catch {
    return { promise: Promise.reject(new Error("Could not start the microphone.")), cancel: () => {} };
  }
  return { promise, cancel: () => rec.abort() };
}
