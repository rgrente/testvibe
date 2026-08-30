const FAMILY_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** Browser-safe formatter for the domain's year/month/day date precision. */
export function formatFamilyDate(value: string | null, locale = "fr-FR"): string {
  const match = value?.match(FAMILY_DATE);
  if (!match || !value) return "Date inconnue";
  const year = Number(match[1]);
  const month = Number(match[2] ?? "1");
  const day = Number(match[3] ?? "1");
  if (month < 1 || month > 12) return "Date inconnue";
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > lastDay) return "Date inconnue";
  if (!match[2]) return value;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(locale, match[3]
    ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
    : { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
