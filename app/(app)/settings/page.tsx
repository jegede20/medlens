"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ProfileEditor } from "@/components/ProfileEditor";
import { AmberNote, TextSizeControl, Toggle, TopBar } from "@/components/ui";
import { speak, useSpeechSupport } from "@/lib/speech";
import { clearAllData, updateSettings, useAppData } from "@/lib/store";

const LANGS = [
  { code: "en", label: "English", test: "Hello. This is how MedLens will read your results aloud." },
  { code: "es", label: "Español", test: "Hola. Así es como MedLens leerá sus resultados en voz alta." },
  { code: "fr", label: "Français", test: "Bonjour. Voici comment MedLens lira vos résultats à voix haute." },
];

export default function SettingsPage() {
  const { settings } = useAppData();
  const support = useSpeechSupport();
  const [cleared, setCleared] = useState(false);
  const lang = LANGS.find((l) => l.code === settings.language) ?? LANGS[0];

  const clear = async () => {
    if (!window.confirm("Clear all your allergies, goals, saved medicines and settings from this device? This cannot be undone.")) return;
    await clearAllData();
    setCleared(true);
  };

  return (
    <div className="mx-auto max-w-[560px] space-y-5">
      <TopBar title="Settings" backHref="/dashboard" />

      <div id="profile" className="scroll-mt-6">
        <ProfileEditor />
      </div>

      <section className="card space-y-5 p-5" aria-labelledby="reading-title">
        <h2 id="reading-title" className="text-[1.25rem] font-semibold text-teal">Reading and listening</h2>
        <div>
          <p className="mb-2 font-bold">Text size</p>
          <TextSizeControl />
        </div>
        <div className="divide-y divide-line">
          <Toggle checked={settings.voiceMode} onChange={(v) => updateSettings({ voiceMode: v })} label="Voice mode" description="Read results aloud" />
          <Toggle checked={settings.highContrast} onChange={(v) => updateSettings({ highContrast: v })} label="High contrast" description="Stronger colors and borders" />
        </div>
        <div>
          <label htmlFor="rate" className="font-bold">Voice speed</label>
          <input
            id="rate"
            type="range"
            min={0.6}
            max={1.4}
            step={0.1}
            value={settings.voiceRate}
            onChange={(e) => updateSettings({ voiceRate: Number(e.target.value) })}
            className="mt-3 h-3 w-full cursor-pointer accent-[var(--teal)]"
            aria-valuetext={settings.voiceRate < 0.85 ? "Slow" : settings.voiceRate > 1.15 ? "Fast" : "Normal"}
          />
          <div className="mt-1 flex justify-between text-[0.88rem] text-muted" aria-hidden="true">
            <span>Slow</span>
            <span>Normal</span>
            <span>Fast</span>
          </div>
        </div>
        {support.speak ? (
          <button type="button" onClick={() => speak(lang.test, "test")} className="btn glass w-full text-teal">
            <Icon name="speaker" /> Test the voice
          </button>
        ) : (
          <AmberNote>This browser cannot read text aloud. Try Chrome, Edge or Safari. Everything still works with on-screen text.</AmberNote>
        )}
        {!support.listen && support.speak && (
          <p className="text-[0.88rem] text-muted">Spoken questions are not supported in this browser. You can type questions instead.</p>
        )}
      </section>

      <section className="card p-5" aria-labelledby="lang-title">
        <h2 id="lang-title" className="text-[1.25rem] font-semibold text-teal">Country and language</h2>
        <label className="mt-3 flex min-h-12 items-center justify-between gap-3">
          <span>
            <span className="block font-bold">Where you buy your medicines</span>
            <span className="block text-[0.88rem] text-muted">Nigeria uses the NAFDAC register; the US uses FDA labels</span>
          </span>
          <span className="relative">
            <select
              value={settings.country}
              onChange={(e) => updateSettings({ country: e.target.value === "US" ? "US" : "NG" })}
              className="field min-w-36 appearance-none rounded-full pr-10 font-bold"
            >
              <option value="NG">Nigeria</option>
              <option value="US">United States</option>
            </select>
            <Icon name="chevron" size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-teal" />
          </span>
        </label>
        <label className="mt-3 flex min-h-12 items-center justify-between gap-3">
          <span>
            <span className="block font-bold">Result and voice language</span>
            <span className="block text-[0.88rem] text-muted">Label summaries and the reading voice</span>
          </span>
          <span className="relative">
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
              className="field min-w-36 appearance-none rounded-full pr-10 font-bold"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <Icon name="chevron" size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-teal" />
          </span>
        </label>
      </section>

      <section className="card p-5" aria-labelledby="data-title">
        <h2 id="data-title" className="text-[1.25rem] font-semibold text-teal">Your data</h2>
        <p className="mt-2 text-muted">Your allergies, goals and saved medicines are kept on this device. Clearing them cannot be undone.</p>
        <button type="button" onClick={clear} className="btn btn-danger mt-4 w-full">
          <Icon name="trash" /> Clear all my data
        </button>
        {cleared && (
          <p role="status" className="mt-3 font-bold text-teal">
            All your data has been cleared from this device.
          </p>
        )}
      </section>

      <section className="card p-2" aria-labelledby="about-title">
        <h2 id="about-title" className="px-3 pt-3 text-[1.25rem] font-semibold text-teal">About and safety</h2>
        <ul className="mt-1 divide-y divide-line">
          {[
            ["Medical disclaimer", "disclaimer"],
            ["How label data is used", "data"],
            ["Privacy", "privacy"],
            ["Terms", "terms"],
          ].map(([label, hash]) => (
            <li key={hash}>
              <Link href={`/legal#${hash}`} className="flex min-h-14 items-center justify-between rounded-2xl px-3 font-bold hover:bg-mint-2">
                {label}
                <Icon name="chevron" className="text-teal" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <AmberNote>MedLens explains labels. It does not replace your doctor or pharmacist.</AmberNote>
      <p className="text-center text-[0.85rem] text-muted">MedLens version 1.0.0</p>
    </div>
  );
}
