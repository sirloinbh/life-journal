// Question picking for the terms quiz (#218). Kept apart from the screen so it can be tested with a
// fixed random source.

export type QuizTerm = { id: string; term: string; learned: boolean };

// A question names terms by id, so a learned mark that changes a term does not change the question.
export type QuizQuestion = { answerId: string; choiceIds: string[] };

export const CHOICE_COUNT = 4;

type Random = () => number;

function pickOne<T>(items: readonly T[], random: Random): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.min(index, Math.floor(random() * (index + 1)));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

const label = (term: QuizTerm) => term.term.trim().toLowerCase();

/**
 * One question from the terms of a domain, or null when there are fewer than two terms to choose
 * from. The answer comes from the terms not marked as learned while there are any, and from all
 * terms after that; the last answer is not asked again right away when another term can be. The
 * choices are the answer and up to three other terms of the same domain with different names, in
 * random order.
 */
export function pickQuestion(
  terms: readonly QuizTerm[],
  random: Random = Math.random,
  lastAnswerId?: string,
): QuizQuestion | null {
  const named = terms.filter((term) => label(term) !== '');
  const unlearned = named.filter((term) => !term.learned);
  const pool = unlearned.length > 0 ? unlearned : named;
  const fresh = pool.filter((term) => term.id !== lastAnswerId);
  const answer = pickOne(fresh.length > 0 ? fresh : pool, random) as QuizTerm | undefined;
  if (!answer) return null;

  // Two terms with the same name could not be told apart, so each name is offered once.
  const seen = new Set([label(answer)]);
  const others = shuffle(
    named.filter((term) => term.id !== answer.id),
    random,
  ).filter((term) => {
    if (seen.has(label(term))) return false;
    seen.add(label(term));
    return true;
  });
  if (others.length === 0) return null;
  const choices = shuffle([answer, ...others.slice(0, CHOICE_COUNT - 1)], random);
  return { answerId: answer.id, choiceIds: choices.map(({ id }) => id) };
}
