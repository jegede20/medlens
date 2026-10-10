"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import { ReadAloud } from "./ui";
import { compareAll, compareLabels } from "@/lib/interactions";
import type { MedResult } from "@/lib/types";

/** Shows label-text matches between medicines. Never claims to be a complete check. */
export function InteractionPanel({ target, others }: { target?: MedResult; others: MedResult[] }) {
  const findings = target ? compareLabels(target, others) : compareAll(others);
  const count = target ? others.length : others.length - 1;
  const notEnough = count < 1;

  const spoken = notEnough
    ? "Save at least two medicines to compare their labels."
    : findings.length
      ? `${findings.length} thing${findings.length > 1 ? "s" : ""} to ask your pharmacist about. ${findings.map((f) => f.detail).join(" ")} This is not a complete interaction check.`
      : "The saved labels do not mention each other. This is not a complete interaction check, so always ask your pharmacist.";

  return (
    <section className="rounded-[24px] border border-amber-soft bg-caution p-5 text-caution-ink" aria-labelledby="ix-title">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#8a5a00]">
          <Icon name="shield" size={20} />
        </span>
        <h2 id="ix-title" className="flex-1 text-[1.2rem] font-semibold leading-tight">Is this safe with my other medicines?</h2>
        <ReadAloud id="ix" text={spoken} label="Read aloud: medicine check" />
      </div>
      <p className="mt-2 text-[0.92rem]">
        We compare the warnings on the labels you have saved. This is not a complete check, so always ask your pharmacist.
      </p>

      {notEnough ? (
        <p className="mt-4 rounded-2xl bg-white/70 p-4">
          {target ? "You have no other saved medicines to compare with yet." : "Save at least two medicines to compare their labels."}{" "}
          <Link href="/scan" className="font-bold text-teal underline">Scan a medicine</Link>
        </p>
      ) : findings.length === 0 ? (
        <p className="mt-4 flex gap-3 rounded-2xl border border-mint-5 bg-mint-1 p-4 text-ink">
          <Icon name="check" className="mt-0.5 text-teal" />
          <span>
            The labels we compared ({target ? `${target.query.name} with ${count} saved medicine${count > 1 ? "s" : ""}` : `${others.length} medicines`}) do not
            mention each other. That does not mean they are safe together. Ask your pharmacist.
          </span>
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {findings.map((f, i) => (
            <li key={i} className="rounded-2xl bg-white p-4 text-ink">
              <p className="flex items-start gap-2 font-bold text-caution-ink">
                <Icon name="warning" className="mt-0.5 text-[#8a5a00]" /> {f.title}
              </p>
              <p className="mt-1">{f.detail}</p>
              {f.quote && <blockquote className="mt-2 border-l-4 border-amber-soft pl-3 text-[0.9rem] text-muted">Label text: “{f.quote}”</blockquote>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[0.88rem] font-bold">Based on label text only. Not a complete interaction check.</p>
    </section>
  );
}
