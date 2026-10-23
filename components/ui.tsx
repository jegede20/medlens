"use client";

import { useRouter } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { speak, stopSpeaking, useSpeakingId, useSpeechSupport } from "@/lib/speech";
import { updateSettings, useAppData } from "@/lib/store";
import type { Settings } from "@/lib/types";

/** Read-aloud control. Round icon button by default; `wide` shows a labelled pill. */
export function ReadAloud({
  text,
  id,
  label = "Read aloud",
  wide = false,
  tone = "glass",
  className = "",
  lang,
}: {
  text: string;
  id: string;
  lang?: string;
  label?: string;
  wide?: boolean;
  tone?: "glass" | "onTeal" | "outline";
  className?: string;
}) {
  const speakingId = useSpeakingId();
  const { speak: supported } = useSpeechSupport();
  if (!supported) return null;
  const active = speakingId === id;
  const toggle = () => (active ? stopSpeaking() : speak(text, id, undefined, lang));
  const toneClass = tone === "onTeal" ? "glass-on-teal" : tone === "outline" ? "btn-outline" : "glass text-teal";
  if (wide) {
    return (
      <button type="button" onClick={toggle} aria-pressed={active} className={`btn ${toneClass} ${className}`}>
        <Icon name={active ? "stop" : "speaker"} />
        {active ? "Stop reading" : label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? "Stop reading" : `${label}`}
      aria-pressed={active}
      className={`grid size-11 shrink-0 place-items-center rounded-full ${toneClass} ${className}`}
    >
      <Icon name={active ? "stop" : "speaker"} size={20} />
    </button>
  );
}

export function PharmacistBar({ text = "Ask your doctor or pharmacist before any medical decision.", sticky = true }: { text?: string; sticky?: boolean }) {
  return (
    <div
      role="note"
      className={`glass-amber z-30 flex items-center gap-3 rounded-[20px] px-4 py-3 text-[0.95rem] font-bold ${
        sticky ? "sticky bottom-[calc(var(--tabbar-offset,0px)+12px)] mt-6" : ""
      }`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber/30">
        <Icon name="info" size={18} />
      </span>
      <span>{text}</span>
    </div>
  );
}

export function AmberNote({ children, icon = "info" }: { children: React.ReactNode; icon?: IconName }) {
  return (
    <div className="flex gap-3 rounded-[18px] border border-amber-soft bg-caution px-4 py-3 text-[0.95rem] text-caution-ink">
      <Icon name={icon} size={20} className="mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

export function TopBar({ title, subtitle, step, onBack, backHref }: { title: string; subtitle?: string; step?: number; onBack?: () => void; backHref?: string }) {
  const router = useRouter();
  const back = onBack ?? (() => (backHref ? router.push(backHref) : window.history.length > 1 ? router.back() : router.push("/dashboard")));
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={back} aria-label="Go back" className="glass grid size-12 shrink-0 place-items-center rounded-full text-teal">
          <Icon name="back" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-[1.3rem] font-semibold leading-tight text-teal">{title}</h1>
          {(subtitle || step) && <p className="text-[0.88rem] text-muted">{subtitle ?? `Step ${step} of 3`}</p>}
        </div>
        <span className="size-12 shrink-0" aria-hidden="true" />
      </div>
      {step && (
        <div className="mt-4 grid grid-cols-3 gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-2 rounded-full ${n <= step ? "bg-teal" : "bg-mint-3"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-bold">{label}</span>
        {description && <span className="block text-[0.88rem] text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-8 w-14 rounded-full bg-mint-5 transition-colors peer-checked:bg-teal peer-focus-visible:outline-3 peer-focus-visible:outline-amber" />
        <span className="absolute left-1 top-1 size-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-6" />
      </span>
    </label>
  );
}

const TAGS = {
  red: "bg-danger-tint text-danger border-danger-line",
  amber: "bg-caution text-caution-ink border-amber-soft",
  mint: "bg-mint-1 text-teal border-mint-5",
  grey: "bg-[#F1F3F2] text-muted border-line",
};

export function Tag({ tone, children }: { tone: keyof typeof TAGS; children: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[0.78rem] font-bold ${TAGS[tone]}`}>{children}</span>;
}

const TILES = { mint: "bg-mint-1 text-teal", amber: "bg-caution text-[#8a5a00]", red: "bg-danger-tint text-danger", teal: "bg-white/15 text-white" };

export function IconTile({ icon, tone = "mint", size = "md" }: { icon: IconName; tone?: keyof typeof TILES; size?: "sm" | "md" }) {
  return (
    <span className={`grid shrink-0 place-items-center ${size === "sm" ? "size-10 rounded-xl" : "size-12 rounded-2xl"} ${TILES[tone]}`}>
      <Icon name={icon} size={size === "sm" ? 20 : 24} />
    </span>
  );
}

export function TextSizeControl({ compact = false }: { compact?: boolean }) {
  const { settings } = useAppData();
  const sizes: Settings["textSize"][] = [1, 2, 3, 4];
  return (
    <div role="radiogroup" aria-label="Text size" className={`flex gap-1 rounded-full bg-white p-1 ${compact ? "" : "border border-line"}`}>
      {sizes.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={settings.textSize === s}
          aria-label={`Text size ${s} of 4`}
          onClick={() => updateSettings({ textSize: s })}
          className={`grid flex-1 place-items-center rounded-full font-display font-bold ${compact ? "h-9" : "h-12"} ${
            settings.textSize === s ? "bg-teal text-white" : "text-teal hover:bg-mint-1"
          }`}
          style={{ fontSize: `${(compact ? 0.68 : 0.8) + s * (compact ? 0.12 : 0.17)}rem` }}
        >
          A
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-12 text-center">
      <span className="size-12 animate-spin rounded-full border-4 border-mint-3 border-t-teal" />
      <p className="text-[1.05rem] font-bold text-teal">{label}</p>
    </div>
  );
}
