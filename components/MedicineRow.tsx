"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import { IconTile, ReadAloud } from "./ui";
import { medTitle } from "./ResultView";
import type { SavedMedicine } from "@/lib/types";

function when(ts: number) {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return "Scanned today";
  if (days === 1) return "Scanned yesterday";
  return `Scanned ${new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

export function MedicineRow({ med }: { med: SavedMedicine }) {
  const title = medTitle(med.result);
  return (
    <li className="flex items-center gap-3 py-3">
      <IconTile icon="pill" size="sm" />
      <Link href={`/medicines?id=${med.id}`} className="min-w-0 flex-1">
        <span className="block truncate font-bold">{title}</span>
        <span className="block text-[0.88rem] text-muted">{when(med.savedAt)} · Label confirmed</span>
      </Link>
      <ReadAloud id={`row-${med.id}`} text={`${title}. ${med.result.oneLine}`} label={`Read aloud: ${title}`} />
      <Link href={`/medicines?id=${med.id}`} aria-label={`Open ${title}`} className="grid size-10 place-items-center rounded-full text-teal hover:bg-mint-1">
        <Icon name="chevron" />
      </Link>
    </li>
  );
}
