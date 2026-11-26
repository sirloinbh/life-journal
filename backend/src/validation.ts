// Input checks the item routes share (items.ts, item-quotes.ts, item-logs.ts).
import { z } from 'zod/v4';

import { SCORES } from './contract.js';

// PostgreSQL rejects NUL and lone surrogates inside jsonb and text, which would otherwise surface as a 500.
export const isStorable = (value: string) => !value.includes('\0') && !/\p{Cs}/u.test(value);

// Line ends are stored as \n, as in the review; the text is trimmed.
export const lines = (value: string) => value.replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n').trim();

// One `error` answers both a wrong type and unknown keys, which zod 3 kept apart.
export const strictObject = <Shape extends z.ZodRawShape>(
  fields: Shape,
  unknownKeys: string,
  otherwise: (input: unknown) => string,
) =>
  z.strictObject(fields, {
    error: (issue) => (issue.code === 'unrecognized_keys' ? unknownKeys : otherwise(issue.input)),
  });

const isRealDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

export const date = (label: string) => {
  const message = `${label} must be a real date in YYYY-MM-DD format`;
  return z.string({ error: message }).refine(isRealDate, message);
};

const scores: readonly number[] = SCORES;
const scoreRange = `from ${scores[0]} to ${scores.at(-1)} in steps of ${scores[1] - scores[0]}`;

export const score = (label: string) => {
  const message = `${label} must be ${scoreRange}`;
  return z.number({ error: message }).refine((value) => scores.includes(value), message);
};

export const MAX_COST_KRW = 2_147_483_647; // The cost columns are PostgreSQL integers.

const costMessage = 'Cost must be a whole number of won, 0 or more';
export const costKrw = z
  .number({ error: costMessage })
  .refine((cost) => Number.isInteger(cost) && cost >= 0, costMessage)
  .refine((cost) => cost <= MAX_COST_KRW, `Cost must be ${MAX_COST_KRW} won or less`);
