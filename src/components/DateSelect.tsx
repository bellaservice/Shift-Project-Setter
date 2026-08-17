const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function DateSelect() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">Pass Datum</span>
      <div className="flex gap-2">
        <select
          name="year"
          defaultValue={currentYear}
          className="w-1/3 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          name="month"
          defaultValue={now.getMonth() + 1}
          className="w-1/3 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          name="day"
          defaultValue={now.getDate()}
          className="w-1/3 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
