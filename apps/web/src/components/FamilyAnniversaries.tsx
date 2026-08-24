import type { FamilyAnniversary } from "@testvibe/core";
import Link from "next/link";

const typeLabels = { naissance: "Naissance", décès: "Décès", mariage: "Mariage", libre: "Événement" } as const;

export function FamilyAnniversaries({ anniversaries, compact = false }: { anniversaries: FamilyAnniversary[]; compact?: boolean }) {
  if (anniversaries.length === 0) {
    return <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-sm text-amber-900">Aucun anniversaire familial à cette date.</p>;
  }
  const visible = compact ? anniversaries.slice(0, 4) : anniversaries;
  return (
    <ul className="divide-y divide-amber-100 overflow-hidden rounded-lg border border-amber-200 bg-white">
      {visible.map((item) => {
        const eventName = item.event.label?.trim() || typeLabels[item.event.type];
        const eventHref = item.eventId == null ? `/persons/${item.person.id}` : `/persons/${item.person.id}#event-${item.eventId}`;
        return (
          <li key={item.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href={eventHref} className="font-medium text-amber-950 hover:underline">{eventName}</Link>
              <span className="text-slate-600"> — </span>
              <Link href={`/persons/${item.person.id}`} className="text-slate-800 hover:underline">{item.person.firstName} {item.person.lastName}</Link>
            </div>
            {item.yearsElapsed != null && <span className="text-sm text-slate-500">{item.yearsElapsed === 0 ? "Cette année" : `Il y a ${item.yearsElapsed} an${item.yearsElapsed > 1 ? "s" : ""}`}</span>}
          </li>
        );
      })}
    </ul>
  );
}
