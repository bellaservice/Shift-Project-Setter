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

/**
 * Timmarna på ett pass som kanske inte är bekräftat än, med enheten inbakad.
 *
 * Enheten sitter med här och inte som ett " h" bredvid anropet, just för att
 * null-fallet inte ska bli "– h". Ett obekräftat pass får ett tankstreck:
 * "0 h" vore ett besked om att arbetaren inte jobbade, och det är inte vad
 * null betyder (spec 5.3).
 */
export function formatPassTimmar(hours: number | null): string {
  return hours === null ? "–" : `${formatHoursSv(hours)} h`;
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
 * Antal dagar i den valda manaden.
 *
 * Bada varden kravs. Datumfalten fick forr skicka null och fick da 31 dagar
 * respektive en skottfebruari tillbaka, men de star numera alltid pa en
 * riktig manad -- i brist pa ett val den manad anvandaren befinner sig i --
 * sa det finns ingen halv frage kvar att svara pa.
 */
export function daysInMonth(year: number, month: number) {
  // Dag 0 i nasta manad ar sista dagen i den har.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 'YYYY-MM-01' for the month `delta` months away from `monthStart`.
 *
 * The whole reason month arithmetic is done on the *string* rather than on a
 * Date: `new Date(2026, 0, 31)` plus one month is the 3rd of March, because
 * JavaScript rolls the overflow forward. A month start has no day to overflow,
 * so 12 and -1 are the only two cases there are.
 */
export function shiftMonth(monthStart: string, delta: number): string {
  const [year, month] = monthStart.split("-").map(Number);
  // Months as a flat count from year 0, so a delta of any size lands right.
  const total = year * 12 + (month - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

/**
 * Today on the Swedish wall clock, 'YYYY-MM-DD'.
 *
 * Anchored on Europe/Stockholm and not on UTC, for the same reason
 * `stockholmMonthStart` is (spec LD-1.1): between Stockholm midnight and UTC
 * midnight, a UTC-derived "today" is still yesterday — which in the Kalender
 * would put the today-ring on the wrong square for two hours every night.
 */
export function stockholmToday(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Which column a date sits in on a Monday-first grid: 0 = mandag … 6 = sondag.
 *
 * Read through Date.UTC and getUTCDay, never through the local calendar: a
 * 'YYYY-MM-DD' is a calendar date and has no time in it, and parsing it in a
 * timezone west of UTC would slide every square one day to the left.
 */
/**
 * 'YYYY-MM-DD' plus eller minus ett antal dagar, som 'YYYY-MM-DD'.
 *
 * Rakningen sker i UTC med klockan pa 12:00 — samma grepp som resten av filen.
 * Datumet ar en etikett och inte ett ogonblick, och middag ar tillrackligt
 * langt fran bada midnatterna for att en sommartidsovergang inte ska kunna
 * putta resultatet en dag fel.
 */
export function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() + delta);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  // getUTCDay is Sunday-first; Sweden reads a calendar Monday-first.
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The column headings of the Kalender grid, Monday first. */
export const WEEKDAY_SHORT = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

/**
 * Veckodagarna som datumfältens kalender skriver dem: "må", "ti", "on" …
 *
 * Härledda ur WEEKDAY_SHORT i stället för skrivna en tredje gång — två
 * bokstäver av "Mån" är "må", och en lista till att hålla i synk är en lista
 * till som kan börja på fel dag. Gemener för att raden är en rubrik över
 * siffror och inte en rad att läsa: versaler skulle konkurrera med datumen.
 */
export const WEEKDAY_MINI = WEEKDAY_SHORT.map((d) => d.slice(0, 2).toLowerCase());

/** Hela veckodagsnamnen, i samma ordning som WEEKDAY_SHORT. */
export const WEEKDAY_LONG = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
];

/**
 * "Fre" för ett 'YYYY-MM-DD' — raden datumfälten skriver ovanför sin dagruta.
 *
 * Medvetet samma tre bokstäver som Kalenderns kolumnrubriker: de två läses
 * minuter isär, och ett "Fredag" här mot ett "Fre" där skulle få läsaren att
 * stanna och jämföra i stället för att bara känna igen dagen.
 */
export function weekdayShortSv(isoDate: string): string {
  return WEEKDAY_SHORT[weekdayIndex(isoDate)];
}

/** Hela veckodagsnamnet — det som läses upp, där bara "Fre" syns. */
export function weekdayNameSv(isoDate: string): string {
  return WEEKDAY_LONG[weekdayIndex(isoDate)];
}

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * "Fredag 21 augusti" — the heading over one day's sheet in the Kalender.
 *
 * Built on a UTC-noon Date so the formatter cannot cross a date line on its way
 * out, the same trick `formatMonthNameSv` uses. The year is left off: the sheet
 * is opened from a grid that already names the month and year above it.
 */
export function formatWeekdayDateSv(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const text = WEEKDAY_DATE_FORMATTER.format(new Date(Date.UTC(y, m - 1, d, 12)));
  return text.charAt(0).toLocaleUpperCase("sv-SE") + text.slice(1);
}

/**
 * 'YYYY-MM-DD' as the app writes it, or null.
 *
 * The one gate every date that arrives from the query string passes through.
 * `?datum=` is part of the visit rather than part of the app, so it can hold
 * anything at all — and a screen that reads it straight would happily render a
 * month grid for "2026-13-99".
 */
export function parseIsoDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  return value;
}
