import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import {
  CATEGORIES as CATEGORY_RULES,
  CATEGORY_KEYS,
  type CategoryKey,
  type CategoryRule,
  type DetailField,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_NAMES,
  MAX_REVIEW_LENGTH,
  MAX_REVIEW_LINES,
  SCORES,
} from './contract.js';
import { withTransaction } from './standard/db.js';
import { HttpError, parseId } from './standard/http.js';

// The database handle the list query runs on: the pool for the route and the AI tool, a client in a transaction.
export type Db = Pick<Pool, 'query'> | PoolClient;

const MAX_COST_KRW = 2_147_483_647; // items.cost_krw is a PostgreSQL integer.

// Every column except companions, which are personal data and never reach the AI tools (#215).
const SHARED_COLUMNS = `id, category, subtype, title, status, cost_krw AS "costKrw",
  planned_date AS "plannedDate", completed_date AS "completedDate", details,
  rating::float8 AS rating, sub_ratings AS "subRatings", review, link, tags,
  created_at AS "createdAt", updated_at AS "updatedAt"`;
const COLUMNS = `${SHARED_COLUMNS}, companions`;

// Length checks as refinements: zod 4's .min() and .max() also run after a type failure on anything with
// a length, such as an array, and would add a second message.
const minLength = (min: number) => (value: string) => value.length >= min;
const maxLength = (max: number) => (value: string) => value.length <= max;

// PostgreSQL rejects NUL and lone surrogates inside jsonb, which would otherwise surface as a 500.
const isStorable = (value: string) => !value.includes('\0') && !/\p{Cs}/u.test(value);

const text = (label: string, max: number) =>
  z
    .string({
      error: (issue) =>
        issue.input === undefined ? `${label} is required` : `${label} must be text`,
    })
    .trim()
    .refine(minLength(1), `${label} is required`)
    .refine(maxLength(max), `${label} must be ${max} characters or fewer`)
    .refine(isStorable, `${label} contains a character that is not allowed`);

const isRealDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const date = (label: string) => {
  const message = `${label} must be a real date in YYYY-MM-DD format`;
  return z.string({ error: message }).refine(isRealDate, message);
};

// One `error` answers both a wrong type and unknown keys, which zod 3 kept apart.
const strictObject = <Shape extends z.ZodRawShape>(
  fields: Shape,
  unknownKeys: string,
  otherwise: (input: unknown) => string,
) =>
  z.strictObject(fields, {
    error: (issue) => (issue.code === 'unrecognized_keys' ? unknownKeys : otherwise(issue.input)),
  });

const details = (label: string, fields: z.ZodRawShape) =>
  strictObject(
    fields,
    `${label} details contain an unknown field`,
    () => `${label} details are not valid`,
  );

const scores: readonly number[] = SCORES;
const scoreRange = `from ${scores[0]} to ${scores.at(-1)} in steps of ${scores[1] - scores[0]}`;

const score = (label: string) => {
  const message = `${label} must be ${scoreRange}`;
  return z.number({ error: message }).refine((value) => scores.includes(value), message);
};

const criteria = (label: string, names: readonly { key: string; label: string }[]) =>
  strictObject(
    Object.fromEntries(names.map(({ key, label: name }) => [key, score(name).optional()])),
    `${label} ratings contain an unknown criterion`,
    () => `${label} ratings are not valid`,
  );

const reviewText = z
  .string({ error: 'Review must be text' })
  .transform((value) => value.replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n').trim())
  .refine(
    (value) => value.split('\n').length <= MAX_REVIEW_LINES,
    `Review must be ${MAX_REVIEW_LINES} lines or fewer`,
  )
  .refine(
    (value) => value.length <= MAX_REVIEW_LENGTH,
    `Review must be ${MAX_REVIEW_LENGTH} characters or fewer`,
  )
  .refine(isStorable, 'Review contains a character that is not allowed');

// The user opens this link in a browser, so only web addresses may reach an href. The server only stores it.
const isWebLink = (value: string) => {
  if (!/^https?:\/\/\S+$/i.test(value) || !isStorable(value)) return false;
  return URL.canParse(value);
};

const linkMessage = 'Link must be an address that starts with http:// or https://';

const linkText = z
  .string({ error: linkMessage })
  .trim()
  .refine(maxLength(2000), 'Link must be 2000 characters or fewer')
  .refine((value) => value === '' || isWebLink(value), linkMessage);

// #215: a list of free names (tags or companions). Each name is trimmed, and a name that repeats an earlier one when
// letter case is ignored is dropped, so the first spelling stays. The limits apply after that.
const caseless = (name: string) => name.toLowerCase();

const nameList = (label: string, plural: string) =>
  z
    .array(
      z
        .string({ error: `${label} must be text` })
        .transform((value) => value.normalize('NFC').trim())
        .refine(minLength(1), `${label} cannot be empty`)
        .refine(
          maxLength(MAX_ITEM_NAME_LENGTH),
          `${label} must be ${MAX_ITEM_NAME_LENGTH} characters or fewer`,
        )
        .refine(isStorable, `${label} contains a character that is not allowed`),
      { error: `${plural} must be a list of names` },
    )
    .transform((names) =>
      names.filter(
        (name, index) => names.findIndex((other) => caseless(other) === caseless(name)) === index,
      ),
    )
    .refine(
      (names) => names.length <= MAX_ITEM_NAMES,
      `${plural} can have at most ${MAX_ITEM_NAMES} names`,
    );

const tagList = nameList('Tag', 'Tags');
const companionList = nameList('Companion', 'Companions');

const year = (label: string) => {
  const message = `${label} must be a 4-digit year`;
  return z
    .number({ error: message })
    .refine((value) => Number.isInteger(value) && value >= 1000 && value <= 9999, message);
};

const detailField = (field: DetailField) =>
  field.type === 'year' ? year(field.label) : text(field.label, field.maxLength);

type CategorySchemas = {
  label: string;
  subtypes: readonly string[];
  details: z.ZodTypeAny;
  criteria: z.ZodTypeAny;
};

const categorySchemas = (rule: CategoryRule): CategorySchemas => ({
  label: rule.label,
  subtypes: rule.subtypes.map(({ value }) => value),
  details: details(
    rule.label,
    Object.fromEntries(rule.fields.map((field) => [field.key, detailField(field).optional()])),
  ),
  criteria: criteria(rule.label, rule.criteria),
});

// The schemas of each category, built from the shared table (shared/contract.ts).
const CATEGORIES = Object.fromEntries(
  CATEGORY_RULES.map((rule) => [rule.key, categorySchemas(rule)]),
) as Record<CategoryKey, CategorySchemas>;

const categoryMessage = 'The category is not valid';
const statusMessage = 'Status must be wishlist or done';
const costMessage = 'Cost must be a whole number of won, 0 or more';

const status = z.enum(['wishlist', 'done'], { error: statusMessage });
const detailsRecord = z.record(z.string(), z.unknown(), {
  error: 'Category details are not valid',
});
const subRatingsRecord = z.record(z.string(), z.unknown(), {
  error: 'Ratings are not valid',
});

const itemShape = {
  category: z.enum(CATEGORY_KEYS, {
    error: categoryMessage,
  }),
  subtype: text('Subtype', 50).nullable().optional(),
  title: text('Title', 200),
  status,
  costKrw: z
    .number({ error: costMessage })
    .refine((cost) => Number.isInteger(cost) && cost >= 0, costMessage)
    .refine((cost) => cost <= MAX_COST_KRW, `Cost must be ${MAX_COST_KRW} won or less`)
    .nullable()
    .optional(),
  plannedDate: date('Planned date').nullable().optional(),
  completedDate: date('Completed date').nullable().optional(),
  details: detailsRecord,
  rating: score('Overall rating').nullable().optional(),
  subRatings: subRatingsRecord,
  review: reviewText.nullable().optional(),
  link: linkText.nullable().optional(),
  tags: tagList,
  companions: companionList,
};

const itemObject = <Shape extends z.ZodRawShape>(shape: Shape) =>
  strictObject(shape, 'The request contains an unknown field', (input) =>
    input === undefined ? 'Request body is required' : 'Request body is not valid',
  );

export const itemFields = itemObject({
  ...itemShape,
  status: status.default('wishlist'),
  details: detailsRecord.default({}),
  subRatings: subRatingsRecord.default({}),
  tags: tagList.default([]),
  companions: companionList.default([]),
});

// No defaults here: zod 4 applies a default inside .optional(), so PATCH would overwrite fields it did not get.
export const itemPatch = itemObject(itemShape).partial();

// Rules across fields. PATCH runs them on the merged row, so a partial change cannot break them.
function parseItem(input: unknown, today: string) {
  const item = itemFields.parse(input);
  const category = CATEGORIES[item.category];
  const subtype = item.subtype ?? null;
  const { subtypes } = category;
  if (subtypes.length === 0 && subtype !== null) {
    throw new HttpError(400, `${category.label} items cannot have a subtype`);
  }
  if (subtypes.length > 0 && (subtype === null || !subtypes.includes(subtype))) {
    throw new HttpError(400, `The subtype is not valid for ${category.label} items`);
  }
  const completedDate = item.completedDate ?? null;
  if (item.status === 'done' && completedDate === null) {
    throw new HttpError(400, 'Completed items need a completed date');
  }
  if (item.status === 'wishlist' && completedDate !== null) {
    throw new HttpError(400, 'Items that are not done cannot have a completed date');
  }
  if (completedDate !== null && completedDate > today) {
    throw new HttpError(400, 'Completed date cannot be after today');
  }
  const rating = item.rating ?? null;
  const subRatings = category.criteria.parse(item.subRatings) as Record<string, unknown>;
  if (item.status === 'wishlist' && (rating !== null || Object.keys(subRatings).length > 0)) {
    throw new HttpError(400, 'Items that are not done cannot have a rating');
  }
  const review = item.review || null;
  if (item.status === 'wishlist' && review !== null) {
    throw new HttpError(400, 'Items that are not done cannot have a review');
  }
  return {
    category: item.category,
    subtype,
    title: item.title,
    status: item.status,
    costKrw: item.costKrw ?? null,
    plannedDate: item.plannedDate ?? null,
    completedDate,
    details: category.details.parse(item.details),
    rating,
    subRatings,
    review,
    link: item.link || null,
    tags: item.tags,
    companions: item.companions,
  };
}

const notFound = () => new HttpError(404, 'Item not found');

const SORT_COLUMNS = {
  title: 'title',
  // Menu order: the keys are English, so their alphabetical order means nothing on screen.
  category: `array_position(ARRAY[${CATEGORY_KEYS.map((key) => `'${key}'`).join(', ')}], category)`,
  status: 'status',
  costKrw: 'cost_krw',
  plannedDate: 'planned_date',
  completedDate: 'completed_date',
  rating: 'rating',
  createdAt: 'created_at',
};

const queryCost = (label: string) => {
  const message = `${label} must be a whole number from 0 to ${MAX_COST_KRW}`;
  return z
    .string({ error: message })
    .refine((value) => /^\d{1,10}$/.test(value) && Number(value) <= MAX_COST_KRW, message)
    .transform(Number)
    .optional();
};

const queryDate = (label: string) => date(label).optional();

// #144: offset paging of the list (user decision 2026-11-23: limit 1-500, default 100).
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;
const MAX_OFFSET = 1_000_000;

const queryWhole = (label: string, min: number, max: number) => {
  const message = `${label} must be a whole number from ${min} to ${max}`;
  return z
    .string({ error: message })
    .refine(
      (value) => /^\d{1,7}$/.test(value) && Number(value) >= min && Number(value) <= max,
      message,
    )
    .transform(Number)
    .optional();
};

export const listQuery = strictObject(
  {
    q: z
      .string({ error: 'Search term must be a single value' })
      .trim()
      .refine(maxLength(100), 'Search term must be 100 characters or fewer')
      .refine(isStorable, 'Search term contains a character that is not allowed')
      .optional(),
    category: z
      .enum(CATEGORY_KEYS, {
        error: categoryMessage,
      })
      .optional(),
    status: z.enum(['wishlist', 'done'], { error: statusMessage }).optional(),
    from: queryDate('Start date'),
    to: queryDate('End date'),
    costMin: queryCost('Minimum cost'),
    costMax: queryCost('Maximum cost'),
    sort: z
      .enum(
        [
          'title',
          'category',
          'status',
          'costKrw',
          'plannedDate',
          'completedDate',
          'rating',
          'createdAt',
        ],
        { error: 'Sort field is not valid' },
      )
      .default('createdAt'),
    order: z.enum(['asc', 'desc'], { error: 'Sort order is not valid' }).default('desc'),
    limit: queryWhole('Page size', 1, MAX_PAGE_SIZE),
    offset: queryWhole('Offset', 0, MAX_OFFSET),
  },
  'The search contains an unknown filter',
  () => 'Search filters are not valid',
);

function listSql(input: unknown, columns = COLUMNS) {
  const query = listQuery.parse(input);
  if (query.from && query.to && query.from > query.to) {
    throw new HttpError(400, 'Start date cannot be after end date');
  }
  if (query.costMin !== undefined && query.costMax !== undefined && query.costMin > query.costMax) {
    throw new HttpError(400, 'Minimum cost cannot be greater than maximum cost');
  }
  const params: unknown[] = [];
  const where: string[] = [];
  const param = (value: unknown) => `$${params.push(value)}`;
  if (query.q) {
    const pattern = param(`%${query.q.replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`(title ILIKE ${pattern} ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM jsonb_each_text(details) AS field
                 WHERE field.value ILIKE ${pattern} ESCAPE '\\'))`);
  }
  if (query.category) where.push(`category = ${param(query.category)}`);
  if (query.status) where.push(`status = ${param(query.status)}`);
  // A done item happened on its completed date; anything else is planned.
  if (query.from) where.push(`COALESCE(completed_date, planned_date) >= ${param(query.from)}`);
  if (query.to) where.push(`COALESCE(completed_date, planned_date) <= ${param(query.to)}`);
  if (query.costMin !== undefined) where.push(`cost_krw >= ${param(query.costMin)}`);
  if (query.costMax !== undefined) where.push(`cost_krw <= ${param(query.costMax)}`);
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';
  const filter = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  // id breaks ties, so every row has one place in the order and offset pages neither repeat nor skip rows.
  const order = `ORDER BY ${SORT_COLUMNS[query.sort]} ${direction} NULLS LAST, id DESC`;
  return {
    page: (limit: number, offset: number) => ({
      text: `SELECT ${columns} FROM items ${filter} ${order}
        LIMIT ${param(Math.trunc(limit))} OFFSET ${param(Math.trunc(offset))}`,
      params,
    }),
    count: { text: `SELECT count(*)::int AS total FROM items ${filter}`, params: [...params] },
    query,
  };
}

// The AI tool list_items: the first `limit` items (project-standards#711), without companions (#215).
export async function listItems(db: Db, query: unknown, limit: number) {
  const { text, params } = listSql(query, SHARED_COLUMNS).page(limit, 0);
  const { rows } = await db.query(text, params);
  return { items: rows };
}

// The route (#144): one page, the offset of the next page (null on the last one), and the number of matching items.
async function listItemsPage(db: Db, input: unknown) {
  const sql = listSql(input);
  const offset = sql.query.offset ?? 0;
  const page = sql.page(sql.query.limit ?? DEFAULT_PAGE_SIZE, offset);
  const [{ rows }, counted] = await Promise.all([
    db.query(page.text, page.params),
    db.query<{ total: number }>(sql.count.text, sql.count.params),
  ]);
  const total = counted.rows[0]?.total ?? 0;
  const next = offset + rows.length;
  return { items: rows, nextOffset: rows.length > 0 && next < total ? next : null, total };
}

export function createItemsRouter(pool: Pool, today: () => string) {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await listItemsPage(pool, req.query));
  });

  router.post('/', async (req, res) => {
    const item = parseItem(req.body, today());
    const { rows } = await pool.query(
      `INSERT INTO items
         (category, subtype, title, status, cost_krw, planned_date, completed_date, details,
          rating, sub_ratings, review, link, tags, companions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING ${COLUMNS}`,
      [
        item.category,
        item.subtype,
        item.title,
        item.status,
        item.costKrw,
        item.plannedDate,
        item.completedDate,
        item.details,
        item.rating,
        item.subRatings,
        item.review,
        item.link,
        item.tags,
        item.companions,
      ],
    );
    res.status(201).json(rows[0]);
  });

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM items WHERE id = $1`, [id]);
    if (rows.length === 0) throw notFound();
    res.json(rows[0]);
  });

  router.patch('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const patch = itemPatch.parse(req.body);
    if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update');
    const updated = await withTransaction(pool, async (client: PoolClient) => {
      const { rows: current } = await client.query(
        `SELECT ${COLUMNS} FROM items WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (current.length === 0) throw notFound();
      const {
        category,
        subtype,
        title,
        status,
        costKrw,
        plannedDate,
        completedDate,
        details,
        rating,
        subRatings,
        review,
        link,
        tags,
        companions,
      } = current[0];
      const item = parseItem(
        {
          category,
          subtype,
          title,
          status,
          costKrw,
          plannedDate,
          completedDate,
          details,
          rating,
          subRatings,
          review,
          link,
          tags,
          companions,
          ...patch,
        },
        today(),
      );
      const { rows } = await client.query(
        `UPDATE items
         SET category = $2, subtype = $3, title = $4, status = $5, cost_krw = $6,
             planned_date = $7, completed_date = $8, details = $9, rating = $10,
             sub_ratings = $11, review = $12, link = $13, tags = $14, companions = $15,
             updated_at = now()
         WHERE id = $1
         RETURNING ${COLUMNS}`,
        [
          id,
          item.category,
          item.subtype,
          item.title,
          item.status,
          item.costKrw,
          item.plannedDate,
          item.completedDate,
          item.details,
          item.rating,
          item.subRatings,
          item.review,
          item.link,
          item.tags,
          item.companions,
        ],
      );
      return rows[0];
    });
    res.json(updated);
  });

  router.delete('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const { rowCount } = await pool.query('DELETE FROM items WHERE id = $1', [id]);
    if (rowCount === 0) throw notFound();
    res.status(204).end();
  });

  return router;
}
