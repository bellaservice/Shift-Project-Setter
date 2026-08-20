// Swedish month name for the "Månads pass" subtitle (spec LD-1.4).

/**
 * The single label the app uses when it refers to a project. "Project Namn" is
 * the source of truth; `address` is the fallback for rows saved before the
 * field existed, so a list row can never render blank.
 */
export function projectLabel(project: { name: string | null; address: string }): string {
  return project.name ?? project.address;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  month: "long",
  timeZone: "UTC",
});

/**
 * Takes the `monthStart` string that `getHomeStats` counted against — never
 * `new Date()`. That is what guarantees the label names the month that was
 * actually counted, including in the hours after Stockholm midnight on the 1st
 * when a UTC-anchored clock still reads as the previous month.
 */
export function formatMonthNameSv(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const name = MONTH_FORMATTER.format(utcNoon);

  return name.charAt(0).toLocaleUpperCase("sv-SE") + name.slice(1);
}

/**
 * "Augusti 2026" — the heading above one month's group on Alla Project. Carries
 * the year, unlike the home screen's month label: the list spans every project
 * ever logged, so two "Augusti" groups from different years must not collide.
 */
export function formatMonthYearSv(isoDate: string): string {
  const [year] = isoDate.split("-");
  return `${formatMonthNameSv(isoDate)} ${year}`;
}

/**
 * Hours the way the Arbetsdagbok prints them: at most one decimal, Swedish
 * decimal comma, no trailing ",0". Mirrors DocMaker's sumOrdinarieTid.
 */
export function formatHoursSv(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(".", ",");
}

/** 'HH:MM' eller 'HH:MM:SS' -> minuter sedan midnatt, eller null om värdet
 *  varken är det ena eller det andra. */
function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const [, h, m] = match.map(Number);
  return h * 60 + m;
}

/**
 * Längden på ett pass i timmar, räknat ur "Pass Tider". Ett slut före sin start
 * läses som ett nattpass över midnatt (22:00–06:00 = 8h) i stället för som ett
 * negativt tal. Ett spann på noll är inget pass och räknas som inget svar alls.
 *
 * Delas av formuläret som loggar passet och av arbetsdagbokens kontroll av att
 * Pass Timmar och Pass Tider säger samma sak — två kopior av den här
 * midnattsregeln skulle förr eller senare glídja isär.
 */
export function passSpanHours(start: string, end: string): number | null {
  const from = timeToMinutes(start);
  const to = timeToMinutes(end);
  if (from === null || to === null) return null;

  const minutes = to >= from ? to - from : to + 24 * 60 - from;
  if (minutes === 0) return null;

  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * The "Pass Tider" cell: '07:00–16:00'. Postgres hands back `time` as
 * 'HH:MM:SS', and the seconds are noise on a work log. Returns '' when the pass
 * predates the columns, so the cell prints empty rather than '–'.
 */
export function formatPassTider(
  start: string | null,
  end: string | null
): string {
  if (!start || !end) return "";
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

/**
 * 'YYYY-MM-01' for the month an ISO date or timestamp falls in, read on the
 * Swedish wall clock so a project started late on the last evening of a month
 * is not filed under the next one.
 */
export function monthStartOf(isoDateOrTimestamp: string): string {
  // A bare 'YYYY-MM-DD' is already a Stockholm-local calendar date; only a
  // timestamp needs converting out of UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDateOrTimestamp)) {
    return `${isoDateOrTimestamp.slice(0, 7)}-01`;
  }

  const local = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDateOrTimestamp));

  return `${local.slice(0, 7)}-01`;
}

/**
 * Manadsnamnen som datumfaltens paneler visar. Skrivna for hand i stallet for
 * hamtade ur Intl: panelen vill ha dem versaliserade och i sin egen ordning,
 * och listan ar densamma varje ar.
 */
export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Mars",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Augusti",
  "September",
  "Oktober",
  "November",
  "December",
];

/** Manad och dag lagras tvasiffrigt, precis som i YYYY-MM-DD. */
export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Antal dagar i den valda manaden. Utan manad visas 31 dagar, och utan ar
 * raknas februari som skottmanad -- annars skulle den 29:e forsvinna innan
 * anvandaren hunnit skriva aret.
 */
export function daysInMonth(year: number | null, month: number | null) {
  if (!month) return 31;
  // Dag 0 i nasta manad ar sista dagen i den har.
  return new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate();
}
