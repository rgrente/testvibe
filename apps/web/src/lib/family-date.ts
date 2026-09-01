const FAMILY_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const MIN_DATE = "0001-01-01";
const MAX_DATE = "9999-12-31";

export interface ParsedFamilyDate {
  original: string;
  qualification: "exact" | "about" | "before" | "after" | "between";
  precision: "year" | "month" | "day";
  lower: string | null;
  upper: string | null;
}

interface ParsedSimpleFamilyDate {
  precision: ParsedFamilyDate["precision"];
  lower: string;
  upper: string;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseSimpleFamilyDate(value: string): ParsedSimpleFamilyDate | null {
  const match = FAMILY_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2] ?? 1);
  const day = Number(match[3] ?? 1);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  const precision = match[3] ? "day" : match[2] ? "month" : "year";
  return {
    precision,
    lower: isoDate(year, month, day),
    upper: precision === "year"
      ? isoDate(year, 12, 31)
      : precision === "month"
        ? isoDate(year, month, daysInMonth(year, month))
        : isoDate(year, month, day),
  };
}

function shiftDay(value: string, days: number): string | null {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  const shifted = new Date(timestamp + days * 86_400_000).toISOString().slice(0, 10);
  return shifted < MIN_DATE || shifted > MAX_DATE ? null : shifted;
}

function shiftBoundToYear(value: string, year: number): string {
  const month = Number(value.slice(5, 7));
  const day = Math.min(Number(value.slice(8, 10)), daysInMonth(year, month));
  return isoDate(year, month, day);
}

/** Browser-safe parser mirroring the qualified genealogical-date domain contract. */
export function parseFamilyDate(original: string | null): ParsedFamilyDate | null {
  if (!original || original.trim() !== original) return null;
  const between = /^entre (.+) et (.+)$/.exec(original);
  if (between) {
    const start = parseSimpleFamilyDate(between[1]);
    const end = parseSimpleFamilyDate(between[2]);
    if (!start || !end || start.precision !== end.precision || start.lower > end.upper) return null;
    return { original, qualification: "between", precision: start.precision, lower: start.lower, upper: end.upper };
  }
  const qualified = /^(vers|avant|après) (.+)$/.exec(original);
  const simple = parseSimpleFamilyDate(qualified?.[2] ?? original);
  if (!simple) return null;
  if (!qualified) return { original, qualification: "exact", ...simple };
  if (qualified[1] === "avant") {
    const upper = shiftDay(simple.lower, -1);
    return upper ? { original, qualification: "before", precision: simple.precision, lower: null, upper } : null;
  }
  if (qualified[1] === "après") {
    const lower = shiftDay(simple.upper, 1);
    return lower ? { original, qualification: "after", precision: simple.precision, lower, upper: null } : null;
  }
  const lowerYear = Math.max(1, Number(simple.lower.slice(0, 4)) - 1);
  const upperYear = Math.min(9999, Number(simple.upper.slice(0, 4)) + 1);
  return {
    original,
    qualification: "about",
    precision: simple.precision,
    lower: shiftBoundToYear(simple.lower, lowerYear),
    upper: shiftBoundToYear(simple.upper, upperYear),
  };
}

function formatSimpleFamilyDate(value: string, locale: string): string | null {
  const parsed = parseSimpleFamilyDate(value);
  if (!parsed) return null;
  if (parsed.precision === "year") return value;
  const date = new Date(`${parsed.lower}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, parsed.precision === "month"
    ? { month: "long", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

/** Browser-safe formatter for exact and qualified genealogical dates. */
export function formatFamilyDate(value: string | null, locale = "fr-FR"): string {
  const parsed = parseFamilyDate(value);
  if (!parsed || !value) return "Date inconnue";
  if (parsed.qualification === "between") {
    const match = /^entre (.+) et (.+)$/.exec(value)!;
    return `entre ${formatSimpleFamilyDate(match[1], locale)} et ${formatSimpleFamilyDate(match[2], locale)}`;
  }
  const qualified = /^(vers|avant|après) (.+)$/.exec(value);
  if (qualified) return `${qualified[1]} ${formatSimpleFamilyDate(qualified[2], locale)}`;
  return formatSimpleFamilyDate(value, locale) ?? "Date inconnue";
}
