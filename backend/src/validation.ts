// Input checks the item routes share (items.ts, item-quotes.ts).
import { z } from 'zod/v4';

// PostgreSQL rejects NUL and lone surrogates inside jsonb and text, which would otherwise surface as a 500.
export const isStorable = (value: string) => !value.includes('\0') && !/\p{Cs}/u.test(value);

// One `error` answers both a wrong type and unknown keys, which zod 3 kept apart.
export const strictObject = <Shape extends z.ZodRawShape>(
  fields: Shape,
  unknownKeys: string,
  otherwise: (input: unknown) => string,
) =>
  z.strictObject(fields, {
    error: (issue) => (issue.code === 'unrecognized_keys' ? unknownKeys : otherwise(issue.input)),
  });
