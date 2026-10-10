"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { LogoMark } from "@/components/Logo";
import { MedicineRow } from "@/components/MedicineRow";
import { ProfileEditor } from "@/components/ProfileEditor";
import { IconTile, PharmacistBar } from "@/components/ui";
import { listenOnce, speak } from "@/lib/speech";
import { getAppData, useAppData } from "@/lib/store";

const noop = () => () => {};
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// Spoken commands handled on the device.
const COMMANDS: { re: RegExp; href: string; say: string }[] = [
  { re: /barcode/i, href: "/scan?mode=barcode", say: "Opening the barcode scanner." },
  { re: /safe|other medicine|interact|together/i, href: "/medicines?check=1", say: "Checking your saved medicines." },
  { re: /product|ingredient|allerg|food/i, href: "/checker", say: "Opening the product checker." },
  { re: /scan|photo|camera|box|read/i, href: "/scan", say: "Opening the scanner." },
  { re: /my medicine|saved|list/i, href: "/medicines", say: "Opening your medicines." },
  { re: /setting|text size|bigger|voice|contrast/i, href: "/settings", say: "Opening settings." },
];

export default function Dashboard() {
  const router = useRouter();
  const { medicines } = useAppData();
  const hello = useSyncExternalStore(noop, greeting, () => "Hello");
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);

  const askByVoice = async () => {
    setVoiceStatus("Listening… say for example “scan a medicine” or “my medicines”.");
    try {
      const said = await listenOnce().promise;
      const saved = getAppData().medicines.find((m) => said.toLowerCase().includes(m.result.query.name.toLowerCase()));
      if (saved) {
        speak(`Opening ${saved.result.query.name}.`);
        return router.push(`/medicines?id=${saved.id}`);
      }
      const cmd = COMMANDS.find((c) => c.re.test(said));
      if (cmd) {
        speak(cmd.say);
        return router.push(cmd.href);
      }
      const help = `Sorry, I heard “${said}”. You can say: scan a medicine, scan barcode, my medicines, check a product, or settings.`;
      setVoiceStatus(help);
      speak(help);
    } catch (e) {
      setVoiceStatus((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-bold text-muted">{hello}</p>
          <h1 className="text-[clamp(1.7rem,2.5vw+0.9rem,2.4rem)] font-bold leading-tight text-teal">What would you like to check?</h1>
        </div>
        <button type="button" onClick={askByVoice} className="btn glass text-teal">
          <Icon name="mic" /> Ask by voice
        </button>
      </div>
      {voiceStatus && (
        <p role="status" className="rounded-2xl bg-mint-1 px-4 py-3 font-bold text-teal">
          {voiceStatus}
        </p>
      )}

      {/* Scan card */}
      <section className="relative overflow-hidden rounded-[28px] bg-teal p-6 text-white sm:p-8">
        <span className="absolute -right-16 -top-20 size-72 rounded-full bg-teal-soft" aria-hidden="true" />
        <span className="absolute right-6 top-6 size-10 rounded-full bg-amber" aria-hidden="true" />
        <div className="relative flex items-center gap-6">
          <div className="min-w-0 flex-1 pr-10 sm:pr-0">
            <h2 className="text-[clamp(1.5rem,2vw+0.9rem,2.1rem)] font-bold">Scan a medicine</h2>
            <p className="mt-2 max-w-lg text-white/90">Take a photo of the box. You will confirm the name and strength before anything is shown.</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href="/scan" className="btn glass-on-teal">
                <Icon name="camera" /> Take photo
              </Link>
              <Link href="/scan?mode=barcode" className="btn glass-on-teal">
                <Icon name="barcode" /> Scan barcode
              </Link>
              <Link href="/scan?mode=upload" className="btn glass-on-teal">
                <Icon name="upload" /> Upload photo
              </Link>
            </div>
          </div>
          <div className="hidden shrink-0 sm:block" aria-hidden="true">
            <LogoMark onDark size={150} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="card p-5" aria-labelledby="meds-title">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="meds-title" className="text-[1.25rem] font-semibold text-teal">My medicines</h2>
            <Link href="/medicines" className="font-bold text-teal hover:underline">See all</Link>
          </div>
          {medicines.length ? (
            <ul className="divide-y divide-line">
              {medicines.slice(0, 4).map((m) => (
                <MedicineRow key={m.id} med={m} />
              ))}
            </ul>
          ) : (
            <p className="py-4 text-muted">
              No saved medicines yet. Scan a box and tap “Save to My medicines”. They stay on this device.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <div className="flex items-center gap-3">
              <IconTile icon="shield" />
              <h2 className="text-[1.25rem] font-semibold text-teal">Product checker</h2>
            </div>
            <p className="mt-3 text-muted">Scan a product to see ingredients that clash with your allergies and goals, in simple words.</p>
            <Link href="/checker" className="btn glass-teal mt-4">Check a product</Link>
          </section>
          <section className="rounded-[24px] border border-amber-soft bg-caution p-5 text-caution-ink">
            <h2 className="text-[1.2rem] font-semibold">Is this safe with my other medicines?</h2>
            <p className="mt-2">We compare the warnings on the labels you have saved. This is not a complete check, so always ask your pharmacist.</p>
            <Link href="/medicines?check=1" className="btn mt-4 bg-teal-deep text-white">Check my list</Link>
          </section>
        </div>
      </div>

      <ProfileEditor />

      <PharmacistBar sticky={false} text="Ask your doctor or pharmacist before making any medical decision. MedLens explains labels and does not give personal medical advice." />
    </div>
  );
}
