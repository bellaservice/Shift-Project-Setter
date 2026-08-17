// Parses a "YYYY-MM-DD" date-only string as a local date (avoids the
// UTC-midnight off-by-one that `new Date(isoString)` can produce).
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
