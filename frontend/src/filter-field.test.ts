import { expect, test } from 'vitest';

import { needsReset, typedCondition } from './filter-field';

// How a browser reports a date field: a half-typed or impossible date reads as '' with badInput.
const field = (value: string, badInput = false) => ({ value, validity: { badInput } });

test('a typed value becomes the condition, trimmed', () => {
  expect(typedCondition(field(' 2026-03-28 '))).toBe('2026-03-28');
  expect(typedCondition(field(' 1000 '))).toBe('1000');
});

test('an emptied field clears the condition', () => {
  expect(typedCondition(field(''))).toBe('');
});

test('a half-typed date asks for nothing, so the existing condition stays', () => {
  expect(typedCondition(field('', true))).toBeNull();
});

test('a field is reset when it shows another value or a half-typed date', () => {
  expect(needsReset(field('2026-03-28'), '2026-03-28')).toBe(false);
  expect(needsReset(field(' 2026-03-28 '), '2026-03-28')).toBe(false);
  expect(needsReset(field('2026-04-01'), '2026-03-28')).toBe(true);
  // Clearing the conditions must empty a half-typed date, though its value already reads as ''.
  expect(needsReset(field('', true), '')).toBe(true);
  expect(needsReset(field(''), '')).toBe(false);
});
