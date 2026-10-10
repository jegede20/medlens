"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { InteractionPanel } from "@/components/InteractionPanel";
import { MedicineRow } from "@/components/MedicineRow";
import { ResultView } from "@/components/ResultView";
import { PharmacistBar, Spinner, TopBar } from "@/components/ui";
import { removeMedicine, useAppData } from "@/lib/store";

export default function MedicinesPage() {
  return (
    <Suspense fallback={<Spinner label="Loading your medicines…" />}>
      <Medicines />
    </Suspense>
  );
}

function Medicines() {
  const params = useSearchParams();
  const router = useRouter();
  const { medicines } = useAppData();
  const id = params.get("id");
  const [showCheck, setShowCheck] = useState(params.get("check") === "1");
  const [detailCheck, setDetailCheck] = useState(false);

  if (id) {
    const med = medicines.find((m) => m.id === id);
    return (
      <div className="mx-auto max-w-[540px]">
        <TopBar title="Saved medicine" subtitle="Stored on this device" backHref="/medicines" />
        {!med ? (
          <div className="card p-6 text-center">
            <p className="text-muted">This medicine is no longer saved on this device.</p>
            <Link href="/medicines" className="btn btn-outline mt-4">Back to My medicines</Link>
          </div>
        ) : (
          <ResultView key={med.id} result={med.result}>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => setDetailCheck((v) => !v)} aria-expanded={detailCheck} className="btn glass-teal min-h-14">
                <Icon name="shield" /> Check against my other medicines
              </button>
              {detailCheck && <InteractionPanel target={med.result} others={medicines.filter((m) => m.id !== med.id).map((m) => m.result)} />}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove ${med.result.query.name} from My medicines?`)) {
                    removeMedicine(med.id);
                    router.push("/medicines");
                  }
                }}
                className="btn btn-danger min-h-14"
              >
                <Icon name="trash" /> Remove from My medicines
              </button>
            </div>
          </ResultView>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <div>
        <h1 className="text-[clamp(1.7rem,2.5vw+0.9rem,2.3rem)] font-bold text-teal">My medicines</h1>
        <p className="text-muted">Saved on this device only. Tap a medicine to read its label summary again.</p>
      </div>

      <section className="card p-5">
        {medicines.length ? (
          <ul className="divide-y divide-line">
            {medicines.map((m) => (
              <MedicineRow key={m.id} med={m} />
            ))}
          </ul>
        ) : (
          <div className="py-6 text-center">
            <p className="text-muted">No saved medicines yet.</p>
            <Link href="/scan" className="btn glass-teal mt-4">
              <Icon name="scan" /> Scan a medicine
            </Link>
          </div>
        )}
      </section>

      {medicines.length > 0 && (
        <button type="button" onClick={() => setShowCheck((v) => !v)} aria-expanded={showCheck} className="btn glass-teal w-full min-h-14">
          <Icon name="shield" /> Is this safe with my other medicines?
        </button>
      )}
      {showCheck && <InteractionPanel others={medicines.map((m) => m.result)} />}

      <PharmacistBar />
    </div>
  );
}
