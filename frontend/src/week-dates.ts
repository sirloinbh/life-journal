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
