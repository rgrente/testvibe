import type { FamilyAnniversary, FamilyFactCategory } from "@testvibe/core";
import Link from "next/link";

const typeLabels: Record<FamilyFactCategory, string> = {
  naissance: "Naissance",
  décès: "Décès",
  mariage: "Mariage",
  pacs: "Pacs",
  "union libre": "Union libre",
  résidence: "Résidence",
  libre: "Événement",
};

export function FamilyAnniversaries({ anniversaries, compact = false }: { anniversaries: FamilyAnniversary[]; compact?: boolean }) {
  if (anniversaries.length === 0) {
    return <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-sm text-amber-900">Aucun anniversaire familial à cette date.</p>;
  }
  const visible = compact ? anniversaries.slice(0, 4) : anniversaries;
  return (
    <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white">
      {visible.map((item) => {
        const eventName = item.event.label?.trim() || typeLabels[item.event.type];
        const eventHref = item.eventId == null ? `/persons/${item.person.id}` : `/persons/${item.person.id}#event-${item.eventId}`;
        return (
          <li key={item.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href={eventHref} className="inline-flex min-h-11 items-center font-medium text-amber-950 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">{eventName}</Link>
              <span className="text-slate-600"> — </span>
              <Link href={`/persons/${item.person.id}`} className="inline-flex min-h-11 items-center text-slate-800 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">{item.person.firstName} {item.person.lastName}</Link>
            </div>
            {item.yearsElapsed != null && <span className="text-sm text-slate-500">{item.yearsElapsed === 0 ? "Cette année" : `Il y a ${item.yearsElapsed} an${item.yearsElapsed > 1 ? "s" : ""}`}</span>}
          </li>
        );
      })}
    </ul>
  );
}
