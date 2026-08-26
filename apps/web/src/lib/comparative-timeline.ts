import type { ComparativeTimelineRow, Event, Person } from "@testvibe/core";

export interface TimelineConnection {
  parentId: number;
  childId: number;
  age: number | null;
}

export interface ConnectionRowRange {
  firstRow: number;
  lastRow: number;
}

export interface PositionedTimelineEvent {
  id: number;
  type: Event["type"];
  label: string | null;
  displayDate: string | null;
  position?: number;
  lane?: number;
}

export interface PreparedTimelineRow {
  person: Person;
  life: {
    startPosition: number;
    endPosition: number;
    openEnded: boolean;
  } | null;
  datedEvents: Array<PositionedTimelineEvent & { displayDate: string; position: number; lane: number }>;
  undatedEvents: PositionedTimelineEvent[];
  maxLanes: number;
}

export interface PreparedComparativeTimeline {
  startYear: number | null;
  endYear: number | null;
  ticks: number[];
  rows: PreparedTimelineRow[];
}

function dateValue(value: string | null): number | null {
  const match = value?.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2] ?? "01");
  const day = Number(match[3] ?? "01");
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]) {
    return null;
  }

  const elapsedDays = monthLengths.slice(0, month - 1).reduce((total, length) => total + length, 0) + day - 1;
  return year + elapsedDays / (leapYear ? 366 : 365);
}

function position(value: number, startYear: number, endYear: number): number {
  return ((value - startYear) / (endYear - startYear)) * 100;
}

function tickStep(span: number): number {
  if (span <= 60) return 5;
  if (span <= 160) return 10;
  if (span <= 320) return 20;
  return 50;
}

function personName(person: Person): string {
  return `${person.lastName}\u0000${person.firstName}`;
}

/** Overlap threshold: events within this many percentage points are considered overlapping. */
const LANE_OVERLAP_PCT = 5;

function assignLanes(events: Array<{ position: number }>): number[] {
  const lanes: number[] = new Array(events.length);
  const lastInLane: number[] = []; // last event index placed in each lane

  for (let i = 0; i < events.length; i++) {
    let lane = 0;
    while (
      lastInLane[lane] !== undefined &&
      events[lastInLane[lane]].position + LANE_OVERLAP_PCT >= events[i].position
    ) {
      lane++;
    }
    lanes[i] = lane;
    lastInLane[lane] = i;
  }

  return lanes;
}

export function assignConnectionLanes(ranges: ConnectionRowRange[]): number[] {
  const lanes = new Array<number>(ranges.length);
  const lastRowInLane: number[] = [];
  const sortedRangeIndexes = ranges
    .map((_range, index) => index)
    .sort((a, b) => ranges[a].firstRow - ranges[b].firstRow || ranges[a].lastRow - ranges[b].lastRow || a - b);

  for (const rangeIndex of sortedRangeIndexes) {
    let lane = 0;
    while (lastRowInLane[lane] !== undefined && lastRowInLane[lane] > ranges[rangeIndex].firstRow) {
      lane++;
    }
    lanes[rangeIndex] = lane;
    lastRowInLane[lane] = ranges[rangeIndex].lastRow;
  }

  return lanes;
}

export function prepareComparativeTimeline(
  rows: ComparativeTimelineRow[],
  { preserveRowOrder = false }: { preserveRowOrder?: boolean } = {},
): PreparedComparativeTimeline {
  const values = rows.flatMap(({ person, events }) => [
    dateValue(person.birthDate),
    dateValue(person.deathDate),
    ...events.map((event) => dateValue(event.eventDate)),
  ]).filter((value): value is number => value !== null);

  const startYear = values.length > 0 ? Math.floor(Math.min(...values) / 10) * 10 : null;
  let endYear = values.length > 0 ? Math.ceil(Math.max(...values) / 10) * 10 : null;
  if (startYear !== null && endYear === startYear) endYear += 10;

  let preparedRows = rows
    .map(({ person, events }): PreparedTimelineRow & { birthValue: number | null } => {
      const birthValue = dateValue(person.birthDate);
      const deathValue = dateValue(person.deathDate);
      const datedEvents: Array<PositionedTimelineEvent & { displayDate: string; position: number }> = [];
      const undatedEvents: PreparedTimelineRow["undatedEvents"] = [];

      for (const event of events) {
        const value = dateValue(event.eventDate);
        const preparedEvent: PositionedTimelineEvent = {
          id: event.id,
          type: event.type,
          label: event.label,
          displayDate: event.eventDate,
        };

        if (value !== null && startYear !== null && endYear !== null) {
          datedEvents.push({
            ...preparedEvent,
            displayDate: event.eventDate!,
            position: position(value, startYear, endYear),
          });
        } else {
          undatedEvents.push(preparedEvent);
        }
      }

      datedEvents.sort((a, b) => a.position - b.position || a.id - b.id);

      const lanes = assignLanes(datedEvents);
      const datedWithLanes: PreparedTimelineRow["datedEvents"] = datedEvents.map((ev, i) => ({ ...ev, lane: lanes[i] }));
      const maxLanes = datedWithLanes.length > 0 ? Math.max(...lanes) + 1 : 0;

      return {
        person,
        birthValue,
        life:
          birthValue !== null && startYear !== null && endYear !== null
            ? {
                startPosition: position(birthValue, startYear, endYear),
                endPosition:
                  deathValue !== null && deathValue >= birthValue
                    ? position(deathValue, startYear, endYear)
                    : 100,
                openEnded: deathValue === null,
              }
            : null,
        datedEvents: datedWithLanes,
        undatedEvents,
        maxLanes,
      };
    });

  if (!preserveRowOrder) {
    preparedRows = preparedRows.sort((a, b) => {
      if (a.birthValue === null && b.birthValue !== null) return 1;
      if (a.birthValue !== null && b.birthValue === null) return -1;
      if (a.birthValue !== null && b.birthValue !== null && a.birthValue !== b.birthValue) {
        return a.birthValue - b.birthValue;
      }
      return personName(a.person).localeCompare(personName(b.person), "fr");
    });
  }

  const orderedRows = preparedRows.map(({ birthValue: _birthValue, ...row }) => row);

  if (startYear === null || endYear === null) {
    return { startYear: null, endYear: null, ticks: [], rows: orderedRows };
  }

  const step = tickStep(endYear - startYear);
  const ticks: number[] = [];
  for (let year = startYear; year <= endYear; year += step) ticks.push(year);
  if (ticks.at(-1) !== endYear) ticks.push(endYear);

  return { startYear, endYear, ticks, rows: orderedRows };
}
