import { formatFamilyDate, type ComparativeTimelineRow, type FamilyFactCategory } from "@testvibe/core";
import Link from "next/link";
import { assignConnectionLanes, prepareComparativeTimeline, type TimelineConnection, type TimelineLayers } from "../lib/comparative-timeline";

const EVENT_TYPE_LABELS: Record<FamilyFactCategory, string> = {
  naissance: "Naissance",
  décès: "Décès",
  mariage: "Mariage",
  pacs: "Pacs",
  "union libre": "Union libre",
  résidence: "Résidence",
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

function year(value: string | null): number | null {
  const match = value?.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function ageLabel(birthDate: string | null, deathDate: string | null, nowYear: number): string {
  const birthYear = year(birthDate);
  if (birthYear === null) return "âge inconnu";
  const endYear = year(deathDate) ?? nowYear;
  if (endYear < birthYear) return "âge inconnu";
  const birthParts = birthDate?.split("-").map(Number) ?? [];
  const endParts = deathDate?.split("-").map(Number) ?? [];
  const beforeBirthday = birthParts.length === 3 && endParts.length === 3 &&
    (endParts[1] < birthParts[1] || (endParts[1] === birthParts[1] && endParts[2] < birthParts[2]));
  return `${endYear - birthYear - (beforeBirthday ? 1 : 0)} ans`;
}

export function ComparativeTimeline({
  rows,
  connections = [],
  branchByPersonId,
  generationByPersonId,
  layers = { persons: true, events: true, generations: true },
  preserveRowOrder = false,
  nowYear = new Date().getUTCFullYear(),
}: {
  rows: ComparativeTimelineRow[];
  connections?: TimelineConnection[];
  branchByPersonId?: Map<number, number>;
  generationByPersonId?: Map<number, number>;
  layers?: TimelineLayers;
  preserveRowOrder?: boolean;
  nowYear?: number;
}) {
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

  const timeline = prepareComparativeTimeline(rows, { preserveRowOrder, nowYear });
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
  const gridTemplateColumns = `158px ${connectionGutterWidth}px minmax(0, 1fr)`;
  const currentYearPosition = timeline.startYear !== null && timeline.endYear !== null && nowYear >= timeline.startYear && nowYear <= timeline.endYear
    ? ((nowYear - timeline.startYear) / (timeline.endYear - timeline.startYear)) * 100
    : null;

  return (
    <div className="space-y-0">
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-3 font-mono text-[10px] text-slate-600" aria-label="Légende">
        <span className="sr-only">Barre de vie ({branchByPersonId ? "couleur par lignée" : "couleur par personne"})</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-900" aria-hidden="true" /> naissance
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rotate-45 bg-slate-900" aria-hidden="true" /> décès
        </span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rotate-45 border border-slate-600 bg-white" aria-hidden="true" /> union / événement</span>
        <span className="ml-auto">Molette horizontale pour parcourir · clic sur une barre pour ouvrir la fiche</span>
      </div>

      <div
        data-testid="timeline-scroll"
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-blue-600"
        tabIndex={0}
        aria-label="Timeline comparative, défilement horizontal"
      >
        <div data-testid="timeline-canvas" style={{ minWidth: `${canvasWidth}px` }}>
          <div
            className="sticky top-0 z-20 grid border-b border-slate-200 bg-white/95"
            style={{ gridTemplateColumns }}
          >
            <div data-testid="timeline-person-column" className="sticky left-0 z-30 border-r border-slate-200 bg-white" style={{ width: "158px" }} aria-hidden="true" />
            <div aria-hidden="true" className="border-r border-slate-200" />
            <div className="relative h-9" aria-label={`Axe chronologique de ${timeline.startYear ?? "date inconnue"} à ${timeline.endYear ?? "date inconnue"}`}>
              {timeline.ticks.map((year) => {
                const tickPosition = ((year - timeline.startYear!) / (timeline.endYear! - timeline.startYear!)) * 100;
                return (
                  <div
                    key={year}
                    className="absolute inset-y-0 border-l border-slate-200"
                    style={{ left: `${tickPosition}%` }}
                  >
                    <span className="absolute left-1 top-1.5 font-mono text-[10px] text-slate-500">{year}</span>
                  </div>
                );
              })}
              {timeline.startYear === null && (
                <p className="px-4 py-4 text-sm text-slate-500">Aucune date exploitable pour construire l’échelle.</p>
              )}
              {currentYearPosition !== null && (
                <span className="absolute inset-y-0 z-10 w-px bg-blue-600" style={{ left: `${currentYearPosition}%` }} aria-label={`Année courante ${nowYear}`}>
                  <span className="absolute -top-0.5 -translate-x-1/2 rounded-sm bg-blue-700 px-1 py-0.5 font-mono text-[9px] font-semibold text-white">{nowYear}</span>
                </span>
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
                <div
                  data-testid={`timeline-person-${row.person.id}`}
                  className="sticky left-0 z-10 flex flex-col justify-center overflow-hidden border-b border-r border-slate-100 bg-white px-2.5 shadow-[3px_0_5px_-5px_rgba(15,23,42,0.4)]"
                  style={{ gridColumn: 1, gridRow: rowIndex + 1, height: "36px" }}
                >
                  {layers.persons ? (
                    <Link href={`/persons/${row.person.id}`} className="truncate text-xs font-semibold text-slate-950 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                      {fullName}
                    </Link>
                  ) : <span className="sr-only">{fullName}</span>}
                  {layers.generations && (
                    <p className="truncate font-mono text-[9.5px] text-slate-500">
                      {generationByPersonId?.has(row.person.id) ? `G${generationByPersonId.get(row.person.id)} · ` : ""}{ageLabel(row.person.birthDate, row.person.deathDate, nowYear)}
                    </p>
                  )}
                </div>

                <div
                  className="relative border-b border-slate-100"
                  style={{ gridColumn: 3, gridRow: rowIndex + 1, height: "36px" }}
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

                  {layers.persons && row.life ? (
                    <Link
                      href={`/persons/${row.person.id}`}
                      aria-label={`Vie de ${fullName} : ${row.person.birthDate ?? "naissance inconnue"} – ${row.life.openEnded ? "décès inconnu" : (row.person.deathDate ?? "décès inconnu")}`}
                      className={`absolute top-[13px] h-[9px] rounded-l-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${row.life.openEnded ? "rounded-r-full" : "rounded-r-full"}`}
                      style={{
                        left: `${row.life.startPosition}%`,
                        width: `${Math.max(row.life.endPosition - row.life.startPosition, 0.4)}%`,
                        backgroundColor: color,
                      }}
                    >
                      <span aria-label={`Naissance de ${fullName}`} className="absolute left-0 top-1/2 h-2 w-2 -translate-x-0.5 -translate-y-1/2 rounded-full" style={{ backgroundColor: colorDark }} />
                      {!row.life.openEnded && <span aria-label={`Décès de ${fullName}`} className="absolute right-0 top-1/2 h-2 w-2 translate-x-0.5 -translate-y-1/2 rotate-45" style={{ backgroundColor: colorDark }} />}
                    </Link>
                  ) : !row.life ? (
                    <p className="sr-only">
                      Naissance inconnue : durée de vie non positionnée.
                    </p>
                  ) : null}

                  {layers.events && row.datedEvents.map((event) => {
                    const typeLabel = EVENT_TYPE_LABELS[event.type];
                    const label = event.label ?? typeLabel;
                    const displayDate = formatFamilyDate(event.displayDate);
                    const accessibleLabel = `${typeLabel}, ${label}, ${displayDate}`;
                    return (
                      <span
                        key={event.id}
                        aria-label={accessibleLabel}
                        title={accessibleLabel}
                        className="absolute top-1/2 z-2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-slate-700 bg-white"
                        style={{ left: `${event.position}%` }}
                      >
                        <span className="sr-only">{label} · {typeLabel} · {displayDate}</span>
                      </span>
                    );
                  })}

                  {layers.events && row.undatedEvents.length > 0 && (
                    <ul
                      className="sr-only"
                      aria-label={`Événements non datés de ${fullName}`}
                    >
                      {row.undatedEvents.map((event) => (
                        <li key={event.id}>
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
