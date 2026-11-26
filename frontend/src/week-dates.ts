// #235: week arithmetic for the Week and 12-week views, on YYYY-MM-DD strings. Weeks start on Sunday,
// like the calendar.

const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const text = (day: Date) => day.toISOString().slice(0, 10);

/** A real date in YYYY-MM-DD form, from 0001-01-01. */
export const isDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const day = utc(value);
  return !Number.isNaN(day.getTime()) && text(day) === value;
};

/** The date `step` days after `date`. */
export function addDays(date: string, step: number) {
  const day = utc(date);
  day.setUTCDate(day.getUTCDate() + step);
  return text(day);
}

/** The Sunday of the week that holds `date`. */
export const weekStart = (date: string) => addDays(date, -utc(date).getUTCDay());

/** The seven dates of the week that starts on `start`. */
export const weekDays = (start: string) => Array.from({ length: 7 }, (_, n) => addDays(start, n));

/** The starts of the `count` weeks that end with the week of `date`, oldest first. */
export function lastWeeks(date: string, count: number) {
  const last = weekStart(date);
  return Array.from({ length: count }, (_, n) => addDays(last, (n - count + 1) * 7));
}
