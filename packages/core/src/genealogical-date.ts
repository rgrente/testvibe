import { ValidationError } from "./errors.js";

export type GenealogicalDateQualification = "exact" | "about" | "before" | "after" | "between" | "legacy_unresolved";
export type GenealogicalDatePrecision = "year" | "month" | "day";

export interface GenealogicalDate {
  original: string;
  qualification: GenealogicalDateQualification;
  precision: GenealogicalDatePrecision;
  lower: string | null;
  upper: string | null;
}

const SIMPLE_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const GEDCOM_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

interface ParsedSimpleDate {
  original: string;
  precision: GenealogicalDatePrecision;
  lower: string;
  upper: string;
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function shiftBoundToYear(value: string, year: number): string {
  const month = Number(value.slice(5, 7));
  const day = Math.min(Number(value.slice(8, 10)), daysInMonth(year, month));
  return isoDate(year, month, day);
}

function previousDay(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function nextDay(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function parseSimpleDate(value: string): ParsedSimpleDate {
  const match = SIMPLE_DATE.exec(value);
  if (!match) throw new ValidationError(`Date généalogique invalide : ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2] ?? 1);
  const day = Number(match[3] ?? 1);
  if (year < 1 || month < 1 || month > 12) throw new ValidationError(`Date généalogique invalide : ${value}`);
  const lastDay = daysInMonth(year, month);
  if (day < 1 || day > lastDay) throw new ValidationError(`Date généalogique invalide : ${value}`);
  const precision: GenealogicalDatePrecision = match[3] ? "day" : match[2] ? "month" : "year";
  return {
    original: value,
    precision,
    lower: isoDate(year, month, day),
    upper: precision === "year" ? isoDate(year, 12, 31) : precision === "month" ? isoDate(year, month, lastDay) : isoDate(year, month, day),
  };
}

export function parseGenealogicalDate(original: string): GenealogicalDate {
  const value = original.trim();
  if (value !== original || value.length === 0) throw new ValidationError(`Date généalogique invalide : ${original}`);
  const between = /^entre (.+) et (.+)$/.exec(value);
  if (between) {
    const start = parseSimpleDate(between[1]);
    const end = parseSimpleDate(between[2]);
    if (start.precision !== end.precision || start.lower > end.upper) {
      throw new ValidationError(`Intervalle généalogique invalide : ${original}`);
    }
    return { original, qualification: "between", precision: start.precision, lower: start.lower, upper: end.upper };
  }
  const qualified = /^(vers|avant|après) (.+)$/.exec(value);
  const simple = parseSimpleDate(qualified?.[2] ?? value);
  if (!qualified) return { original, qualification: "exact", precision: simple.precision, lower: simple.lower, upper: simple.upper };
  if (qualified[1] === "avant") return { original, qualification: "before", precision: simple.precision, lower: null, upper: previousDay(simple.lower) };
  if (qualified[1] === "après") return { original, qualification: "after", precision: simple.precision, lower: nextDay(simple.upper), upper: null };
  const lowerYear = Math.max(1, Number(simple.lower.slice(0, 4)) - 1);
  const upperYear = Number(simple.upper.slice(0, 4)) + 1;
  return {
    original,
    qualification: "about",
    precision: simple.precision,
    lower: shiftBoundToYear(simple.lower, lowerYear),
    upper: shiftBoundToYear(simple.upper, upperYear),
  };
}

export function legacyUnresolvedDate(original: string): GenealogicalDate {
  const simple = parseSimpleDate(original);
  if (simple.precision !== "day") throw new ValidationError("Une date legacy_unresolved doit être complète.");
  return { original, qualification: "legacy_unresolved", precision: "day", lower: simple.lower, upper: simple.upper };
}

export function formatGenealogicalDate(value: GenealogicalDate | null, locale = "fr-FR"): string {
  if (!value) return "Date inconnue";
  if (value.qualification !== "exact") return value.original;
  if (value.precision === "year") return value.original;
  const date = new Date(`${value.lower}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, value.precision === "month"
    ? { month: "long", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

const QUALIFICATION_ORDER: Record<GenealogicalDateQualification, number> = {
  before: 0, exact: 1, about: 2, between: 3, after: 4, legacy_unresolved: 5,
};

export function compareGenealogicalDates(left: GenealogicalDate | null, right: GenealogicalDate | null, leftId = "", rightId = ""): number {
  if (left && !right) return -1;
  if (!left && right) return 1;
  if (!left || !right) return leftId.localeCompare(rightId);
  const lower = (left.lower ?? "").localeCompare(right.lower ?? "");
  if (lower) return lower;
  const upper = (left.upper ?? "9999-12-31").localeCompare(right.upper ?? "9999-12-31");
  if (upper) return upper;
  return QUALIFICATION_ORDER[left.qualification] - QUALIFICATION_ORDER[right.qualification] || leftId.localeCompare(rightId);
}

export function isExactDay(value: GenealogicalDate | null): boolean {
  return value?.qualification === "exact" && value.precision === "day";
}

function simpleToGedcom(value: string): string {
  const parsed = parseSimpleDate(value);
  const [year, month, day] = parsed.lower.split("-");
  if (parsed.precision === "year") return year;
  if (parsed.precision === "month") return `${GEDCOM_MONTHS[Number(month) - 1]} ${year}`;
  return `${Number(day)} ${GEDCOM_MONTHS[Number(month) - 1]} ${year}`;
}

function gedcomSimpleToIso(value: string): string {
  if (/^\d{4}$/.test(value)) return value;
  const monthYear = /^([A-Z]{3}) (\d{4})$/.exec(value);
  if (monthYear) {
    const month = GEDCOM_MONTHS.indexOf(monthYear[1]) + 1;
    if (!month) throw new ValidationError(`Date GEDCOM invalide : ${value}`);
    return `${monthYear[2]}-${String(month).padStart(2, "0")}`;
  }
  const full = /^(\d{1,2}) ([A-Z]{3}) (\d{4})$/.exec(value);
  if (!full) throw new ValidationError(`Date GEDCOM invalide : ${value}`);
  const month = GEDCOM_MONTHS.indexOf(full[2]) + 1;
  if (!month) throw new ValidationError(`Date GEDCOM invalide : ${value}`);
  return `${full[3]}-${String(month).padStart(2, "0")}-${full[1].padStart(2, "0")}`;
}

export function fromGedcomDate(raw: string): GenealogicalDate {
  const between = /^BET (.+) AND (.+)$/.exec(raw);
  if (between) return parseGenealogicalDate(`entre ${gedcomSimpleToIso(between[1])} et ${gedcomSimpleToIso(between[2])}`);
  const qualified = /^(ABT|BEF|AFT) (.+)$/.exec(raw);
  if (qualified) {
    const prefix = qualified[1] === "ABT" ? "vers" : qualified[1] === "BEF" ? "avant" : "après";
    return parseGenealogicalDate(`${prefix} ${gedcomSimpleToIso(qualified[2])}`);
  }
  return parseGenealogicalDate(gedcomSimpleToIso(raw));
}

export function toGedcomDate(value: GenealogicalDate): string {
  if (value.qualification === "between") {
    const match = /^entre (.+) et (.+)$/.exec(value.original)!;
    return `BET ${simpleToGedcom(match[1])} AND ${simpleToGedcom(match[2])}`;
  }
  const qualified = /^(vers|avant|après) (.+)$/.exec(value.original);
  if (qualified) {
    const prefix = qualified[1] === "vers" ? "ABT" : qualified[1] === "avant" ? "BEF" : "AFT";
    return `${prefix} ${simpleToGedcom(qualified[2])}`;
  }
  return simpleToGedcom(value.original);
}

export function formatGenealogicalDateInput(value: string): string {
  return formatGenealogicalDate(parseGenealogicalDate(value));
}

export { MONTHS };
