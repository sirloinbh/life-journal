// #213: month arithmetic of the calendar screen on YYYY-MM strings.

/** A real month in YYYY-MM form, from 0001-01. */
export const isMonth = (value: string) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= '0001-01';

/** The month `step` months after `month` (YYYY-MM), or null outside the years 0001-9999. */
export function shiftMonth(month: string, step: number) {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + step;
  const shifted = `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
  return isMonth(shifted) && shifted <= '9999-12' ? shifted : null;
}

/** Every day of the month as YYYY-MM-DD. */
export function daysOf(month: string) {
  const [year, number] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: count }, (_, day) => `${month}-${String(day + 1).padStart(2, '0')}`);
}
