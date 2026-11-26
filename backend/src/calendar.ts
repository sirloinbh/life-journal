import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

// #213: the items of one month for the calendar screen. Planned and completed dates are DATE columns
// with no time of day, so a month is plain date arithmetic; only "this month" depends on the service
// time zone (Asia/Seoul), which `today` already follows.

const monthMessage = 'Month must be a real month in YYYY-MM format';

const isRealMonth = (value: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month] = match;
  return year >= '0001' && month >= '01' && month <= '12';
};

export const calendarQuery = z.strictObject(
  {
    month: z.string({ error: monthMessage }).refine(isRealMonth, monthMessage).optional(),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? 'The calendar request contains an unknown filter'
        : 'Calendar filters are not valid',
  },
);

// Only what a day of the calendar shows and what opens the item on the bucket list.
const COLUMNS = `id, category, subtype, title, status, planned_date AS "plannedDate",
  completed_date AS "completedDate", rating::float8 AS rating`;

export function createCalendarRouter(pool: Pool, today: () => string) {
  const router = Router();

  // Every item with a planned or a completed date inside the month, oldest date first. An item planned
  // in one month and completed in another appears in both, once each.
  router.get('/', async (req, res) => {
    const query = calendarQuery.parse(req.query);
    const month = query.month ?? today().slice(0, 7);
    // The month runs from its first day up to, not including, the first day of the next month.
    const { rows } = await pool.query(
      `WITH month AS (SELECT $1::date AS month_start, ($1::date + interval '1 month')::date AS month_end)
       SELECT ${COLUMNS} FROM items, month
       WHERE (planned_date >= month_start AND planned_date < month_end)
          OR (completed_date >= month_start AND completed_date < month_end)
       ORDER BY LEAST(
         CASE WHEN planned_date >= month_start AND planned_date < month_end THEN planned_date END,
         CASE WHEN completed_date >= month_start AND completed_date < month_end THEN completed_date END
       ), id`,
      [`${month}-01`],
    );
    res.json({ month, items: rows });
  });

  return router;
}
