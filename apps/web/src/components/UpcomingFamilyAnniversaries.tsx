import type { UpcomingFamilyAnniversary } from "@testvibe/core";
import Link from "next/link";

export function UpcomingFamilyAnniversaries({ anniversaries }: { anniversaries: UpcomingFamilyAnniversary[] }) {
  if (anniversaries.length === 0) {
    return <p className="rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-5 text-sm text-blue-900">Aucun anniversaire de naissance ou de mariage à venir.</p>;
  }

  return (
    <ul className="divide-y divide-blue-100 overflow-hidden rounded-lg border border-blue-200 bg-white">
      {anniversaries.map((item) => {
        const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })
          .format(new Date(`${item.occurrenceDate}T12:00:00Z`));
        return (
          <li key={item.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-medium text-blue-950">{item.type === "naissance" ? "Anniversaire" : "Anniversaire de mariage"}</span>
              <span className="text-slate-600"> — </span>
              {item.persons.map((person, index) => (
                <span key={person.id}>
                  {index > 0 && <span className="text-slate-600"> et </span>}
                  <Link href={`/persons/${person.id}`} className="text-slate-800 hover:underline">{person.firstName} {person.lastName}</Link>
                </span>
              ))}
            </div>
            <span className="text-sm text-slate-500">{date} · dans {item.daysUntil} jour{item.daysUntil > 1 ? "s" : ""} · {item.yearsElapsed} an{item.yearsElapsed > 1 ? "s" : ""}</span>
          </li>
        );
      })}
    </ul>
  );
}
