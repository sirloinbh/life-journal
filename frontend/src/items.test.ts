import { expect, test } from 'vitest';

import { CATEGORIES } from '../../shared/contract';
import {
  addName,
  categories,
  type Item,
  itemFields,
  measureReview,
  numberOrText,
  ratingSummary,
  reviewPreview,
  usedNames,
} from './items';
import { itemRow } from './test/items-api';

test.each([
  ['15000', 15000],
  ['15,000', 15000],
  ['1,234,567', 1234567],
  ['-3', -3],
  ['15.000', '15.000'],
  ['1e3', '1e3'],
  ['1,23', '1,23'],
  ['12,3456', '12,3456'],
  ['abc', 'abc'],
])('numberOrText(%j) is %j', (input, expected) => {
  expect(numberOrText(input)).toBe(expected);
});

test('measureReview counts the review as the server stores it', () => {
  expect(measureReview('  one\r\ntwo\rthree four  ')).toEqual({
    review: 'one\ntwo\nthree\nfour',
    lines: 4,
    length: 18,
  });
  expect(measureReview('   \n  ')).toEqual({ review: '', lines: 0, length: 0 });
});

test('reviewPreview skips lines that show nothing', () => {
  expect(reviewPreview('​\nㅤ\nSecond line\nThird')).toBe('Second line');
  expect(reviewPreview('​\n ⠀')).toBeNull();
  expect(reviewPreview('First')).toBe('First');
});

const reading = categories.find(({ key }) => key === 'reading')!;
const item = (subRatings: Record<string, number>): Item => ({
  id: 1,
  category: 'reading',
  subtype: null,
  title: 'Demian',
  status: 'done',
  costKrw: null,
  plannedDate: null,
  completedDate: '2026-10-01',
  details: {},
  rating: 4,
  subRatings,
  review: null,
  link: null,
  tags: [],
  companions: [],
});

test('ratingSummary lists scored criteria in table order with their average', () => {
  expect(ratingSummary(item({ afterglow: 5, content: 3.5 }), reading)).toBe(
    'Content 3.5 · Lingering impression 5 (sub-rating average 4.3, for reference)',
  );
  expect(ratingSummary(item({}), reading)).toBeNull();
  // A key that is not a criterion of the category is not shown.
  expect(ratingSummary(item({ story: 2 }), reading)).toBeNull();
});

test('the screen categories follow the shared table', () => {
  expect(categories.map(({ key }) => key)).toEqual(CATEGORIES.map(({ key }) => key));
  const drink = categories.find(({ key }) => key === 'drink')!;
  expect(drink.fields.filter(({ numeric }) => numeric).map(({ key }) => key)).toEqual(['vintage']);
});

test('addName trims a name and skips blanks and names already there in any letter case', () => {
  expect(addName(['Family'], '  birthday ')).toEqual(['Family', 'birthday']);
  expect(addName(['Family'], 'FAMILY')).toEqual(['Family']);
  expect(addName(['Family'], '   ')).toEqual(['Family']);
  // Decomposed Hangul (as some keyboards send it) is the same name as the composed one.
  expect(addName(['엄마'], '엄마'.normalize('NFD'))).toEqual(['엄마']);
});

test('itemFields sends the added names and the text still in the field', () => {
  const form = new FormData();
  for (const value of ['family', ' birthday ', 'Family', '']) form.append('tags', value);
  form.append('companions', '엄마');
  const fields = itemFields(categories[0], form);
  expect(fields.tags).toEqual(['family', 'birthday']);
  expect(fields.companions).toEqual(['엄마']);
  expect(itemFields(categories[0], new FormData())).toMatchObject({ tags: [], companions: [] });
});

test('usedNames suggests names from every item, the most used first, one per letter case', () => {
  const items = [
    itemRow(1, { tags: ['birthday', 'family'], companions: ['엄마'] }),
    itemRow(2, { category: 'travel', tags: ['Family', 'autumn'] }),
    itemRow(3, { tags: ['family'], companions: ['아빠', '엄마'] }),
  ];
  expect(usedNames(items, 'tags')).toEqual(['family', 'autumn', 'birthday']);
  expect(usedNames(items, 'companions')).toEqual(['엄마', '아빠']);
  expect(usedNames([], 'tags')).toEqual([]);
});
