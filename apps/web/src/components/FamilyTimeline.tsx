import type { FamilyTimelineItem } from "@testvibe/core";
import Link from "next/link";

const EVENT_TYPE_LABELS: Record<FamilyTimelineItem["event"]["type"], string> = {
  naissance: "Naissance",
  décès: "Décès",
  mariage: "Mariage",
  libre: "Événement",
};

function hasUsableDate(value: string | null): value is string {
  return value !== null && !Number.isNaN(Date.parse(value));
}

function formatDate(value: string): string {
  const fullDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!fullDate) return value;

  const [, year, month, day] = fullDate;
  return `${day}/${month}/${year}`;
}

function EventCard({ entry, showDate }: { entry: FamilyTimelineItem; showDate: boolean }) {
  const { event, person } = entry;

  return (
    <li className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {showDate && event.eventDate && (
          <time dateTime={event.eventDate} className="font-mono text-sm font-semibold text-slate-700">
            {formatDate(event.eventDate)}
          </time>
        )}
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {EVENT_TYPE_LABELS[event.type]}
        </span>
        {event.label && <span className="font-medium text-slate-800">{event.label}</span>}
      </div>
      <Link
        href={`/persons/${person.id}`}
        className="mt-1 inline-block text-sm font-medium text-blue-700 hover:underline"
      >
        {person.firstName} {person.lastName}
      </Link>
      {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
    </li>
  );
}

export function FamilyTimeline({ entries }: { entries: FamilyTimelineItem[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
        <p className="text-slate-600">Aucun événement familial n’est encore disponible.</p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">
          Retour à l’arbre
        </Link>
      </div>
    );
  }

  const datedEntries = entries.filter(({ event }) => hasUsableDate(event.eventDate));
  const undatedEntries = entries.filter(({ event }) => !hasUsableDate(event.eventDate));

  return (
    <div className="space-y-10">
      {datedEntries.length > 0 && (
        <section aria-label="Événements datés">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Événements datés</h2>
          <ol className="space-y-3">
            {datedEntries.map((entry) => (
              <EventCard key={entry.key} entry={entry} showDate />
            ))}
          </ol>
        </section>
      )}

      {undatedEntries.length > 0 && (
        <section aria-label="Événements non datés">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Non datés</h2>
          <ul className="space-y-3">
            {undatedEntries.map((entry) => (
              <EventCard key={entry.key} entry={entry} showDate={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
