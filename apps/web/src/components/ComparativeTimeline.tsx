import type { ComparativeTimelineRow, EventType } from "@testvibe/core";
import Link from "next/link";
import { assignConnectionLanes, prepareComparativeTimeline, type TimelineConnection } from "../lib/comparative-timeline";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  naissance: "Naissance",
  décès: "Décès",
  mariage: "Mariage",
  libre: "Événement",
};

function personColor(id: number): string {
  const hue = (id * 137.5) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function personColorDark(id: number): string {
  const hue = (id * 137.5) % 360;
  return `hsl(${hue}, 65%, 35%)`;
}

export function ComparativeTimeline({ rows, connections = [], branchByPersonId, preserveRowOrder = false }: { rows: ComparativeTimelineRow[]; connections?: TimelineConnection[]; branchByPersonId?: Map<number, number>; preserveRowOrder?: boolean }) {
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

  const timeline = prepareComparativeTimeline(rows, { preserveRowOrder });
  const span =
    timeline.startYear !== null && timeline.endYear !== null
      ? timeline.endYear - timeline.startYear
      : 0;
  const canvasWidth = Math.max(720, span * 8);
  const routedConnections = connections.flatMap((connection) => {
    const parentIndex = timeline.rows.findIndex((row) => row.person.id === connection.parentId);
    const childIndex = timeline.rows.findIndex((row) => row.person.id === connection.childId);
    const parent = timeline.rows[parentIndex];
    const child = timeline.rows[childIndex];
    if (parentIndex < 0 || childIndex < 0 || !parent?.life || !child?.life || parentIndex === childIndex) return [];
    return [{
      connection,
      parentIndex,
      childIndex,
      parentStartPosition: parent.life.startPosition,
      childStartPosition: child.life.startPosition,
      firstRow: Math.min(parentIndex, childIndex) + 1,
      lastRow: Math.max(parentIndex, childIndex) + 2,
    }];
  });
  const connectionLanes = assignConnectionLanes(routedConnections);
  const connectionLaneCount = connectionLanes.length > 0 ? Math.max(...connectionLanes) + 1 : 0;
  const connectionGutterWidth = Math.max(48, connectionLaneCount * 8 + 16);
  const gridTemplateColumns = `220px ${connectionGutterWidth}px minmax(0, 1fr)`;

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="Légende">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-1 w-8 rounded-sm"
            style={{ background: "linear-gradient(to right, #f43f5e, #f59e0b, #10b981, #3b82f6, #8b5cf6)" }}
            aria-hidden="true"
          /> Barre de vie ({branchByPersonId ? "couleur par lignée" : "couleur par personne"})
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-white bg-amber-500 ring-1 ring-amber-600" aria-hidden="true" />
          Événement daté
        </span>
        <span>Une ligne ouverte à droite indique un décès inconnu.</span>
      </div>

      <div
        data-testid="timeline-scroll"
        className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs"
        tabIndex={0}
        aria-label="Timeline comparative, défilement horizontal"
      >
        <div data-testid="timeline-canvas" style={{ minWidth: `${canvasWidth}px` }}>
          <div
            className="sticky top-0 z-20 grid border-b border-slate-200 bg-slate-50/95"
            style={{ gridTemplateColumns }}
          >
            <div className="sticky left-0 z-30 border-r border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Personne
            </div>
            <div aria-hidden="true" className="border-r border-slate-200" />
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

          <div className="grid" style={{ gridTemplateColumns }}>
          {routedConnections.map(({ connection, parentIndex, childIndex, parentStartPosition, childStartPosition, firstRow, lastRow }, connectionIndex) => {
            const colorKey = branchByPersonId?.get(connection.parentId) ?? connection.parentId;
            const color = branchByPersonId && colorKey < 0 ? "#475569" : personColor(colorKey + 1);
            const laneOffset = 8 + connectionLanes[connectionIndex] * 8;
            return (
              <span
                key={`${connection.parentId}-${connection.childId}`}
                data-testid={`timeline-connection-${connection.parentId}-${connection.childId}`}
                aria-label={`Lien parent-enfant${connection.age === null ? "" : `, parent âgé de ${connection.age} ans à la naissance`}`}
                className="pointer-events-none contents"
              >
                <span
                  data-testid={`timeline-connection-lane-${connection.parentId}-${connection.childId}`}
                  className="relative z-5 my-3 border-l-2"
                  style={{ gridColumn: 2, gridRow: `${firstRow} / ${lastRow}`, marginLeft: `${laneOffset}px`, borderColor: color }}
                >
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm bg-white/90 px-1 text-[10px] font-semibold shadow-xs" style={{ color }}>
                    {connection.age === null ? "âge inconnu" : `${connection.age} ans`}
                  </span>
                </span>
                {[
                  { id: "parent", row: parentIndex + 1, position: parentStartPosition },
                  { id: "child", row: childIndex + 1, position: childStartPosition },
                ].map((endpoint) => (
                  <span
                    key={endpoint.id}
                    data-testid={`timeline-connection-${endpoint.id}-arm-${connection.parentId}-${connection.childId}`}
                    aria-hidden="true"
                    className="relative z-5 mt-3 border-t-2"
                    style={{
                      gridColumn: "2 / 4",
                      gridRow: endpoint.row,
                      marginLeft: `${laneOffset}px`,
                      width: `calc(${connectionGutterWidth - laneOffset}px + (100% - ${connectionGutterWidth}px) * ${endpoint.position / 100})`,
                      borderColor: color,
                    }}
                  />
                ))}
              </span>
            );
          })}

          {timeline.rows.map((row, rowIndex) => {
            const fullName = `${row.person.firstName} ${row.person.lastName}`;
            const colorKey = branchByPersonId?.get(row.person.id) ?? row.person.id;
            const color = branchByPersonId && colorKey < 0 ? "#475569" : personColor(colorKey + 1);
            const colorDark = branchByPersonId && colorKey < 0 ? "#334155" : personColorDark(colorKey + 1);
            return (
              <section
                key={row.person.id}
                role="group"
                aria-label={`Timeline de ${fullName}`}
                className="contents"
              >
                <div className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-1.5 shadow-[3px_0_5px_-5px_rgba(15,23,42,0.4)] last:border-b-0" style={{ gridColumn: 1, gridRow: rowIndex + 1 }}>
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
                  className="relative border-b border-slate-100 px-3 py-1.5 last:border-b-0"
                  style={{ gridColumn: 3, gridRow: rowIndex + 1, minHeight: `${Math.max(3, row.maxLanes * 1.5 + 1.5)}rem` }}
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
                      className={`absolute top-2 h-2 rounded-l-full ${row.life.openEnded ? "rounded-r-none border-r-4" : "rounded-r-full"}`}
                      style={{
                        left: `${row.life.startPosition}%`,
                        width: `${Math.max(row.life.endPosition - row.life.startPosition, 0.4)}%`,
                        backgroundColor: color,
                        ...(row.life.openEnded ? { borderRightColor: colorDark } : {}),
                      }}
                    />
                  ) : (
                    <p className="relative z-1 text-sm text-slate-500">
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
                        className={`absolute z-2 flex flex-col ${horizontalAlignment}`}
                        style={{ left: `${event.position}%`, top: `${event.lane * 1.5 + 1.5}rem` }}
                      >
                        <span className="h-4 w-4 rounded-full border-2 border-white bg-amber-500 shadow-sm ring-1 ring-amber-600" aria-hidden="true" />
                        <span className="mt-1 whitespace-nowrap rounded-sm bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-950 shadow-xs">
                          {label} · {typeLabel} · {event.displayDate}
                        </span>
                      </span>
                    );
                  })}

                  {row.undatedEvents.length > 0 && (
                    <ul
                      className="relative z-1 flex flex-wrap gap-2"
                      style={{ marginTop: `${Math.max(3, row.maxLanes * 1.5 + 2)}rem` }}
                      aria-label={`Événements non datés de ${fullName}`}
                    >
                      {row.undatedEvents.map((event) => (
                        <li key={event.id} className="rounded-sm bg-slate-100 px-2 py-1 text-xs text-slate-600">
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
    </div>
  );
}
