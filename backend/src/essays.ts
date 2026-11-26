import { type Request, type Response, Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { tagList } from './items.js';
import { auditContext, writeAudit } from './standard/audit.js';
import { withTransaction } from './standard/db.js';
import { HttpError, parseId } from './standard/http.js';
import { date, isStorable, lines, strictObject } from './validation.js';

// #239: essays, longer writing with a title, a Markdown body, the date it was written, a status (draft or
// done), and tags. The screen saves a draft by itself every few seconds, so the body may be empty and a blank
// title becomes "Untitled". Every change writes an audit row in the same transaction, without the body.

export const MAX_ESSAY_TITLE_LENGTH = 200;
export const MAX_ESSAY_LENGTH = 50_000;
const DEFAULT_TITLE = 'Untitled';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const STATUSES = ['draft', 'done'] as const;

const SUMMARY = `id, title, written_date AS "writtenDate", status, tags, created_at AS "createdAt",
  updated_at AS "updatedAt", CASE WHEN btrim(body) = '' THEN 0
  ELSE cardinality(regexp_split_to_array(btrim(body), '\\s+')) END AS "wordCount"`;
const COLUMNS = `id, title, body, written_date AS "writtenDate", status, tags,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

const title = z
  .string({ error: 'Title must be text' })
  .trim()
  .refine(
    (value) => value.length <= MAX_ESSAY_TITLE_LENGTH,
    `Title must be ${MAX_ESSAY_TITLE_LENGTH} characters or fewer`,
  )
  .refine(isStorable, 'Title contains a character that is not allowed')
  .transform((value) => value || DEFAULT_TITLE);

const body = z
  .string({ error: 'Text must be text' })
  .transform(lines)
  .refine(
    (value) => value.length <= MAX_ESSAY_LENGTH,
    `Text must be ${MAX_ESSAY_LENGTH.toLocaleString('en-US')} characters or fewer`,
  )
  .refine(isStorable, 'Text contains a character that is not allowed');

const fields = {
  title,
  body,
  writtenDate: date('Written date'),
  status: z.enum(STATUSES, { error: 'Status must be draft or done' }),
  tags: tagList,
};

const essayObject = <Shape extends z.ZodRawShape>(shape: Shape) =>
  strictObject(shape, 'The request contains an unknown field', (input) =>
    input === undefined ? 'Request body is required' : 'Request body is not valid',
  );

export const essayInput = essayObject({
  title: fields.title.optional(),
  body: fields.body.optional(),
  writtenDate: fields.writtenDate.optional(),
  status: fields.status.optional(),
  tags: fields.tags.optional(),
});
export const essayPatch = essayObject(fields).partial();

const whole = (label: string, min: number, max: number) => {
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

export const essayListQuery = z.strictObject(
  {
    q: z
      .string({ error: 'Search must be text' })
      .trim()
      .refine((value) => value.length <= 200, 'Search must be 200 characters or fewer')
      .optional(),
    tag: z.string({ error: 'Tag must be text' }).trim().max(50, 'Tag is too long').optional(),
    status: z.enum(STATUSES, { error: 'Status must be draft or done' }).optional(),
    limit: whole('Page size', 1, MAX_PAGE_SIZE),
    offset: whole('Offset', 0, 1_000_000),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? 'The essay request contains an unknown filter'
        : 'Essay filters are not valid',
  },
);

const notFound = () => new HttpError(404, 'Essay not found');

type Row = { id: number; title: string; writtenDate: string; status: string; tags: string[] };

/** The audit row of a change: small facts about the essay, never its text. */
const audit = (req: Request, res: Response, client: PoolClient) => ({
  write: (action: 'create' | 'update' | 'delete', before: Row | null, after: Row | null) =>
    writeAudit(client, {
      ...auditContext(req, res),
      action,
      entity: 'essay',
      entityId: (after ?? before)?.id,
      before: before && { ...before },
      after: after && { ...after },
      omit: ['body'],
    }),
});

const summaryOf = ({ id, title: name, writtenDate, status, tags }: Row): Row => ({
  id,
  title: name,
  writtenDate,
  status,
  tags,
});

export function createEssaysRouter(pool: Pool, today: () => string) {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = essayListQuery.parse(req.query);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;
    const values: unknown[] = [];
    const where: string[] = [];
    const param = (value: unknown) => `$${values.push(value)}`;
    if (query.q) {
      const like = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
      const bound = param(like);
      where.push(`(title ILIKE ${bound} OR body ILIKE ${bound})`);
    }
    if (query.tag) {
      where.push(
        `EXISTS (SELECT 1 FROM unnest(tags) AS name WHERE lower(name) = lower(${param(query.tag)}))`,
      );
    }
    if (query.status) where.push(`status = ${param(query.status)}`);
    const filter = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [{ rows }, counted] = await Promise.all([
      pool.query(
        `SELECT ${SUMMARY} FROM essays ${filter}
         ORDER BY written_date DESC, id DESC LIMIT ${param(limit)} OFFSET ${param(offset)}`,
        values,
      ),
      pool.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM essays ${filter}`,
        values.slice(0, values.length - 2),
      ),
    ]);
    const total = counted.rows[0]?.total ?? 0;
    const next = offset + rows.length;
    res.json({
      essays: rows,
      nextOffset: rows.length > 0 && next < total ? next : null,
      total,
    });
  });

  // The tags already used on any essay, the most used first: the editor and the list pick from them.
  router.get('/tags', async (_req, res) => {
    const { rows } = await pool.query<{ name: string }>(
      `SELECT min(name) AS name FROM essays, unnest(tags) AS name
       GROUP BY lower(name) ORDER BY count(*) DESC, min(name)`,
    );
    res.json({ tags: rows.map(({ name }) => name) });
  });

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'essay');
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM essays WHERE id = $1`, [id]);
    if (rows.length === 0) throw notFound();
    res.json(rows[0]);
  });

  router.post('/', async (req, res) => {
    const input = essayInput.parse(req.body);
    const created = await withTransaction(pool, async (client) => {
      const { rows } = await client.query<Row>(
        `INSERT INTO essays (title, body, written_date, status, tags) VALUES ($1, $2, $3, $4, $5)
         RETURNING ${COLUMNS}`,
        [
          input.title ?? DEFAULT_TITLE,
          input.body ?? '',
          input.writtenDate ?? today(),
          input.status ?? 'draft',
          input.tags ?? [],
        ],
      );
      await audit(req, res, client).write('create', null, summaryOf(rows[0]));
      return rows[0];
    });
    res.status(201).json(created);
  });

  router.patch('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'essay');
    const patch = essayPatch.parse(req.body);
    const columns = (
      [
        ['title', 'title'],
        ['body', 'body'],
        ['writtenDate', 'written_date'],
        ['status', 'status'],
        ['tags', 'tags'],
      ] as const
    ).filter(([key]) => patch[key] !== undefined);
    if (columns.length === 0) throw new HttpError(400, 'Nothing to update');
    const updated = await withTransaction(pool, async (client) => {
      const before = await client.query<Row>(
        `SELECT ${COLUMNS} FROM essays WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (before.rows.length === 0) throw notFound();
      const { rows } = await client.query<Row>(
        `UPDATE essays SET ${columns.map(([, column], index) => `${column} = $${index + 2}`).join(', ')},
           updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, ...columns.map(([key]) => patch[key])],
      );
      await audit(req, res, client).write('update', summaryOf(before.rows[0]), summaryOf(rows[0]));
      return rows[0];
    });
    res.json(updated);
  });

  router.delete('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'essay');
    await withTransaction(pool, async (client) => {
      const { rows } = await client.query<Row>(
        `DELETE FROM essays WHERE id = $1 RETURNING ${COLUMNS}`,
        [id],
      );
      if (rows.length === 0) throw notFound();
      await audit(req, res, client).write('delete', summaryOf(rows[0]), null);
    });
    res.status(204).end();
  });

  return router;
}
