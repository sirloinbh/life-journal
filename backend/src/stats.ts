import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { CATEGORY_KEYS } from './contract.js';

// #212: the statistics of one year of completed items. Counting rules (owner decision recorded on #212,
// the issue's recommendation): only done items count, by completed_date; spending is the sum of cost_krw
// of those items (no cost adds nothing); items with no rating are left out of the averages; ties in the
// top list go to the later completion, then the higher id.

const yearMessage = 'Year must be a 4-digit year from 0001 to 9999';

export const statsQuery = z.strictObject(
  {
    year: z
      .string({ error: yearMessage })
      .refine((value) => /^\d{4}$/.test(value) && value !== '0000', yearMessage)
      .optional(),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? 'The statistics request contains an unknown filter'
        : 'Statistics filters are not valid',
  },
);

export const TOP_RATED = 5;

// The year runs from January 1 up to, not including, January 1 of the next year.
const IN_YEAR = `status = 'done'
  AND completed_date >= $1::date AND completed_date < ($1::date + interval '1 year')`;

type CategoryRow = {
  category: string;
  completed: number;
  rated: number;
  averageRating: number | null;
  spendingKrw: number;
};

export async function yearStats(db: Pick<Pool, 'query'>, year: string) {
  const params = [`${year}-01-01`];
  const [byMonth, byCategory, top] = await Promise.all([
    db.query<{ month: number; category: string; count: number }>(
      `SELECT extract(month FROM completed_date)::int AS month, category, count(*)::int AS count
       FROM items WHERE ${IN_YEAR} GROUP BY 1, 2`,
      params,
    ),
    db.query<CategoryRow>(
      `SELECT category, count(*)::int AS completed, count(rating)::int AS rated,
         round(avg(rating), 2)::float8 AS "averageRating",
         COALESCE(sum(cost_krw), 0)::bigint AS "spendingKrw"
       FROM items WHERE ${IN_YEAR} GROUP BY category`,
      params,
    ),
    db.query(
      `SELECT id, category, subtype, title, rating::float8 AS rating, completed_date AS "completedDate"
       FROM items WHERE ${IN_YEAR} AND rating IS NOT NULL
       ORDER BY rating DESC, completed_date DESC, id DESC LIMIT ${TOP_RATED}`,
      params,
    ),
  ]);

  // Every month and every category appears, in calendar and menu order, so a missing one reads as 0.
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, '0')}`,
    total: 0,
    categories: Object.fromEntries(CATEGORY_KEYS.map((key) => [key, 0])),
  }));
  for (const { month, category, count } of byMonth.rows) {
    const entry = months[month - 1];
    entry.total += count;
    entry.categories[category] = (entry.categories[category] ?? 0) + count;
  }
  const categories = CATEGORY_KEYS.map(
    (key) =>
      byCategory.rows.find((row) => row.category === key) ?? {
        category: key,
        completed: 0,
        rated: 0,
        averageRating: null,
        spendingKrw: 0,
      },
  );
  return {
    year,
    completed: categories.reduce((sum, row) => sum + row.completed, 0),
    spendingKrw: categories.reduce((sum, row) => sum + row.spendingKrw, 0),
    months,
    categories,
    topRated: top.rows,
  };
}

export function createStatsRouter(pool: Pool, today: () => string) {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = statsQuery.parse(req.query);
    res.json(await yearStats(pool, query.year ?? today().slice(0, 4)));
  });

  return router;
}
