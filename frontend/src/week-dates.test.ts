import { expect, test } from 'vitest';

import { addDays, isDate, lastWeeks, weekDays, weekStart } from './week-dates';

test('a week starts on Sunday and has seven days', () => {
  // 2026-11-26 is a Thursday.
  expect(weekStart('2026-11-26')).toBe('2026-11-22');
  expect(weekStart('2026-11-22')).toBe('2026-11-22');
  expect(weekDays('2026-11-22')).toEqual([
    '2026-11-22',
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
    '2026-11-27',
    '2026-11-28',
  ]);
});

test('days and weeks cross month and year ends', () => {
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(weekStart('2027-01-01')).toBe('2026-12-27');
});

test('twelve weeks end with the week of the date, oldest first', () => {
  const weeks = lastWeeks('2026-11-26', 12);
  expect(weeks).toHaveLength(12);
  expect(weeks[11]).toBe('2026-11-22');
  expect(weeks[0]).toBe('2026-09-06');
});

test('only real dates pass', () => {
  expect(isDate('2026-02-28')).toBe(true);
  expect(isDate('2026-02-30')).toBe(false);
  expect(isDate('2026-2-3')).toBe(false);
});
