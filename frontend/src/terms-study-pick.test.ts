import { expect, test } from 'vitest';

import { CHOICE_COUNT, pickQuestion, type QuizTerm } from './terms-study-pick';

const term = (id: string, learned = false, name = id.toUpperCase()): QuizTerm => ({
  id,
  term: name,
  learned,
});

// A repeatable random source, so a failing case can be run again.
function seeded(seed: number) {
  // mulberry32
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const ten = Array.from({ length: 10 }, (_, index) => term(`t${index}`, index >= 2));

test('the answer is always an unlearned term while there are any', () => {
  const random = seeded(1);
  const answers = new Set<string>();
  for (let round = 0; round < 200; round++) {
    const question = pickQuestion(ten, random);
    expect(question).not.toBeNull();
    answers.add(question!.answerId);
  }
  expect([...answers].sort()).toEqual(['t0', 't1']);
});

test('with every term learned, the answer comes from all terms', () => {
  const learned = ten.map((item) => ({ ...item, learned: true }));
  const random = seeded(2);
  const answers = new Set<string>();
  for (let round = 0; round < 300; round++) answers.add(pickQuestion(learned, random)!.answerId);
  expect(answers.size).toBe(10);
});

test('there are four distinct choices that include the answer', () => {
  const random = seeded(3);
  for (let round = 0; round < 200; round++) {
    const question = pickQuestion(ten, random)!;
    expect(question.choiceIds).toHaveLength(CHOICE_COUNT);
    expect(new Set(question.choiceIds).size).toBe(CHOICE_COUNT);
    expect(question.choiceIds).toContain(question.answerId);
  }
});

test('the answer is not always in the same place', () => {
  const random = seeded(4);
  const places = new Set<number>();
  for (let round = 0; round < 100; round++) {
    const question = pickQuestion(ten, random)!;
    places.add(question.choiceIds.indexOf(question.answerId));
  }
  expect(places.size).toBe(CHOICE_COUNT);
});

test('the last answer is not asked again right away when another term can be', () => {
  const random = seeded(5);
  let last = pickQuestion(ten, random)!.answerId;
  for (let round = 0; round < 50; round++) {
    const next = pickQuestion(ten, random, last)!.answerId;
    expect(next).not.toBe(last);
    last = next;
  }
  // With one unlearned term it is asked again rather than a learned one.
  const one = [term('a'), term('b', true), term('c', true)];
  expect(pickQuestion(one, random, 'a')!.answerId).toBe('a');
});

test('terms with the same name are offered once', () => {
  const twins = [term('a', false, 'Aria'), term('b', true, 'aria '), term('c', true, 'Coda')];
  const random = seeded(6);
  for (let round = 0; round < 50; round++) {
    const question = pickQuestion(twins, random)!;
    expect(question.answerId).toBe('a');
    expect([...question.choiceIds].sort()).toEqual(['a', 'c']);
  }
});

test('a small domain gives fewer choices, and fewer than two terms give no question', () => {
  const question = pickQuestion([term('a'), term('b'), term('c')], seeded(7))!;
  expect([...question.choiceIds].sort()).toEqual(['a', 'b', 'c']);
  expect(pickQuestion([term('a')])).toBeNull();
  expect(pickQuestion([])).toBeNull();
  expect(pickQuestion([term('a', false, 'Same'), term('b', false, 'same')])).toBeNull();
});
