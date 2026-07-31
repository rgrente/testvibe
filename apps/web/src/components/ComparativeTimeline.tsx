import type { ComparativeTimelineRow, EventType } from "@testvibe/core";
import Link from "next/link";
import { prepareComparativeTimeline } from "../lib/comparative-timeline";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  naissance: "Naissance",
  décès: "Décès",
  mariage: "Mariage",
  libre: "Événement",
};

export function ComparativeTimeline({ rows }: { rows: ComparativeTimelineRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
        <p className="text-slate-600">Aucune personne n’est encore disponible.</p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">
          Retour à l’arbre
        </Link>
      </div>
    );
  }

  const timeline = prepareComparativeTimeline(rows);
  const span =
    timeline.startYear !== null && timeline.endYear !== null
      ? timeline.endYear - timeline.startYear
      : 0;
  const canvasWidth = Math.max(720, span * 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="Légende">
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-8 rounded bg-blue-500" aria-hidden="true" /> Durée de vie
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-white bg-amber-500 ring-1 ring-amber-600" aria-hidden="true" />
          Événement daté
        </span>
        <span>Une ligne ouverte à droite indique un décès inconnu.</span>
      </div>

      <div
        data-testid="timeline-scroll"
        className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm"
        tabIndex={0}
        aria-label="Timeline comparative, défilement horizontal"
      >
        <div data-testid="timeline-canvas" style={{ minWidth: `${canvasWidth}px` }}>
          <div
            className="sticky top-0 z-20 grid border-b border-slate-200 bg-slate-50/95"
            style={{ gridTemplateColumns: "220px minmax(0, 1fr)" }}
          >
            <div className="sticky left-0 z-30 border-r border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Personne
            </div>
            <div className="relative h-14">
              {timeline.ticks.map((year) => {
                const tickPosition = ((year - timeline.startYear!) / (timeline.endYear! - timeline.startYear!)) * 100;
                return (
                  <div
                    key={year}
                    className="absolute inset-y-0 border-l border-slate-300"
                    style={{ left: `${tickPosition}%` }}
                  >
                    <span className="absolute left-1 top-2 font-mono text-xs text-slate-600">{year}</span>
                  </div>
                );
              })}
              {timeline.startYear === null && (
                <p className="px-4 py-4 text-sm text-slate-500">Aucune date exploitable pour construire l’échelle.</p>
              )}
            </div>
          </div>

          {timeline.rows.map((row) => {
            const fullName = `${row.person.firstName} ${row.person.lastName}`;
            return (
              <section
                key={row.person.id}
                role="group"
                aria-label={`Timeline de ${fullName}`}
                className="grid border-b border-slate-100 last:border-b-0"
                style={{ gridTemplateColumns: "220px minmax(0, 1fr)" }}
              >
                <div className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-4 shadow-[3px_0_5px_-5px_rgba(15,23,42,0.4)]">
                  <Link
                    href={`/persons/${row.person.id}`}
                    className="font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                  >
                    {fullName}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.life ? (row.person.birthDate ?? "naissance inconnue") : "naissance inconnue"} – {row.life && !row.life.openEnded ? (row.person.deathDate ?? "décès inconnu") : "décès inconnu"}
                  </p>
                </div>

                <div
                  className="relative px-3 py-4"
                  style={{ minHeight: `${Math.max(8, row.maxLanes * 4 + 5)}rem` }}
                >
                  {timeline.ticks.map((year) => {
                    const tickPosition = ((year - timeline.startYear!) / (timeline.endYear! - timeline.startYear!)) * 100;
                    return (
                      <span
                        key={year}
                        aria-hidden="true"
                        className="absolute inset-y-0 border-l border-slate-100"
                        style={{ left: `${tickPosition}%` }}
                      />
                    );
                  })}

                  {row.life ? (
                    <span
                      aria-label={`Vie de ${fullName} : ${row.person.birthDate ?? "naissance inconnue"} – ${row.life.openEnded ? "décès inconnu" : (row.person.deathDate ?? "décès inconnu")}`}
                      className={`absolute top-12 h-2 rounded-l-full bg-blue-500 ${row.life.openEnded ? "rounded-r-none border-r-4 border-blue-700" : "rounded-r-full"}`}
                      style={{
                        left: `${row.life.startPosition}%`,
                        width: `${Math.max(row.life.endPosition - row.life.startPosition, 0.4)}%`,
                      }}
                    />
                  ) : (
                    <p className="relative z-[1] text-sm text-slate-500">
                      Naissance inconnue : durée de vie non positionnée.
                    </p>
                  )}

                  {row.datedEvents.map((event) => {
                    const typeLabel = EVENT_TYPE_LABELS[event.type];
                    const label = event.label ?? typeLabel;
                    const accessibleLabel = `${typeLabel}, ${label}, ${event.displayDate}`;
                    const horizontalAlignment =
                      event.position < 10
                        ? "items-start"
                        : event.position > 90
                          ? "-translate-x-full items-end"
                          : "-translate-x-1/2 items-center";
                    return (
                      <span
                        key={event.id}
                        aria-label={accessibleLabel}
                        title={accessibleLabel}
                        className={`absolute z-[2] flex flex-col ${horizontalAlignment}`}
                        style={{ left: `${event.position}%`, top: `${event.lane * 4 + 0.25}rem` }}
                      >
                        <span className="h-4 w-4 rounded-full border-2 border-white bg-amber-500 shadow ring-1 ring-amber-600" aria-hidden="true" />
                        <span className="mt-1 whitespace-nowrap rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-950 shadow-sm">
                          {label} · {typeLabel} · {event.displayDate}
                        </span>
                      </span>
                    );
                  })}

                  {row.undatedEvents.length > 0 && (
                    <ul
                      className="relative z-[1] flex flex-wrap gap-2"
                      style={{ marginTop: `${Math.max(5, row.maxLanes * 4 + 2)}rem` }}
                      aria-label={`Événements non datés de ${fullName}`}
                    >
                      {row.undatedEvents.map((event) => (
                        <li key={event.id} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {event.label ?? EVENT_TYPE_LABELS[event.type]} · {EVENT_TYPE_LABELS[event.type]} · date inconnue
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
