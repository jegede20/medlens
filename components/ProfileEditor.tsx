"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { ALLERGENS, GOALS } from "@/lib/ingredients";
import { updateProfile, useAppData } from "@/lib/store";

/** Allergies and goals, stored on this device only. Used on the dashboard and in Settings. */
export function ProfileEditor() {
  const { profile } = useAppData();
  const [adding, setAdding] = useState<"allergy" | "goal" | null>(null);
  const [custom, setCustom] = useState("");
  const empty = !profile.allergies.length && !profile.goals.length;

  const addAllergy = (a: string) => {
    const name = a.trim().slice(0, 40);
    if (!name || profile.allergies.some((x) => x.toLowerCase() === name.toLowerCase())) return;
    updateProfile({ allergies: [...profile.allergies, name] });
  };
  const addGoal = (g: string) => !profile.goals.includes(g) && updateProfile({ goals: [...profile.goals, g] });

  const options = adding === "allergy" ? Object.keys(ALLERGENS).filter((a) => !profile.allergies.includes(a)) : Object.keys(GOALS).filter((g) => !profile.goals.includes(g));

  return (
    <section className="card p-5" aria-labelledby="profile-title">
      <h2 id="profile-title" className="text-[1.25rem] font-semibold text-teal">Allergies and goals</h2>
      {empty && <p className="mt-1 text-muted">Stored on this device only. Nothing added yet.</p>}

      {profile.allergies.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[0.9rem] font-bold text-muted">Allergies</p>
          <ChipList items={profile.allergies} tone="red" onRemove={(a) => updateProfile({ allergies: profile.allergies.filter((x) => x !== a) })} />
        </div>
      )}
      {profile.goals.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[0.9rem] font-bold text-muted">Goals</p>
          <ChipList items={profile.goals} tone="amber" onRemove={(g) => updateProfile({ goals: profile.goals.filter((x) => x !== g) })} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(["allergy", "goal"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-expanded={adding === k}
            onClick={() => setAdding(adding === k ? null : k)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-dashed px-4 font-bold ${adding === k ? "border-teal bg-mint-1 text-teal" : "border-mint-5 text-teal"}`}
          >
            <Icon name="plus" size={18} /> Add {k}
          </button>
        ))}
      </div>

      {adding && (
        <div className="mt-4 rounded-2xl bg-mint-2 p-4">
          <p className="mb-3 font-bold">{adding === "allergy" ? "Tap an allergy to add it" : "Tap a goal to add it"}</p>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => (adding === "allergy" ? addAllergy(o) : addGoal(o))}
                className="min-h-10 rounded-full border border-line bg-white px-3.5 font-bold text-ink hover:border-teal"
              >
                {o}
              </button>
            ))}
            {!options.length && <p className="text-muted">All options added.</p>}
          </div>
          {adding === "allergy" && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addAllergy(custom);
                setCustom("");
              }}
            >
              <label htmlFor="custom-allergy" className="sr-only">Other allergy</label>
              <input id="custom-allergy" className="field flex-1 rounded-full" placeholder="Other, for example: kiwi" value={custom} onChange={(e) => setCustom(e.target.value)} />
              <button type="submit" className="btn glass-teal px-5">Add</button>
            </form>
          )}
          <button type="button" onClick={() => setAdding(null)} className="mt-3 font-bold text-teal underline">Done</button>
        </div>
      )}

      <p className="mt-4 text-[0.88rem] text-muted">These stay on this device and are used to flag ingredients.</p>
    </section>
  );
}

export function ChipList({ items, tone, onRemove }: { items: string[]; tone: "red" | "amber"; onRemove?: (item: string) => void }) {
  const cls = tone === "red" ? "border-danger-line bg-danger-tint text-danger" : "border-amber-soft bg-caution text-caution-ink";
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => (
        <li key={i} className={`inline-flex min-h-10 items-center gap-1 rounded-full border pl-3.5 font-bold ${onRemove ? "pr-1" : "pr-3.5"} ${cls}`}>
          {i}
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${i}`} className="grid size-8 place-items-center rounded-full hover:bg-white/60">
              <Icon name="x" size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
