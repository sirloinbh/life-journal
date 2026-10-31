import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

import { HttpError, parseId } from './standard/http.js';

const MAX_COST_KRW = 2_147_483_647; // items.cost_krw is a PostgreSQL integer.

const COLUMNS = `id, category, subtype, title, status, cost_krw AS "costKrw",
  planned_date AS "plannedDate", completed_date AS "completedDate", details,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

// PostgreSQL rejects NUL and lone surrogates inside jsonb, which would otherwise surface as a 500.
const isStorable = (value: string) => !value.includes('\0') && !/\p{Cs}/u.test(value);

const text = (label: string, max: number) =>
  z
    .string({
      required_error: `${label}을(를) 입력해 주세요`,
      invalid_type_error: `${label}은(는) 문자로 입력해 주세요`,
    })
    .trim()
    .min(1, `${label}을(를) 입력해 주세요`)
    .max(max, `${label}은(는) ${max}자 이하로 입력해 주세요`)
    .refine(isStorable, `${label}에 사용할 수 없는 문자가 있습니다`);

const isRealDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const date = (label: string) => {
  const message = `${label}은(는) YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요`;
  return z
    .string({ required_error: message, invalid_type_error: message })
    .refine(isRealDate, message);
};

const details = (label: string, fields: z.ZodRawShape) =>
  z
    .object(fields, { invalid_type_error: `${label} 정보 형식이 올바르지 않습니다` })
    .strict(`${label} 정보에 없는 항목이 있습니다`);

const vintageMessage = '빈티지는 4자리 연도로 입력해 주세요';

const CATEGORIES = {
  reading: {
    label: '독서',
    subtypes: [],
    details: details('독서', {
      author: text('저자', 100).optional(),
      publisher: text('출판사', 100).optional(),
    }),
  },
  screen: {
    label: '영화·드라마',
    subtypes: ['movie', 'drama'],
    details: details('영화·드라마', {
      director: text('감독', 100).optional(),
      cast: text('출연진', 200).optional(),
    }),
  },
  stage: {
    label: '연극·공연·뮤지컬·오페라',
    subtypes: ['play', 'performance', 'musical', 'opera'],
    details: details('연극·공연·뮤지컬·오페라', {
      venue: text('공연장', 100).optional(),
      cast: text('출연진', 200).optional(),
    }),
  },
  drink: {
    label: '와인·위스키·사케',
    subtypes: ['wine', 'whisky', 'sake'],
    details: details('와인·위스키·사케', {
      producer: text('생산자', 100).optional(),
      region: text('산지', 100).optional(),
      vintage: z
        .number({ invalid_type_error: vintageMessage })
        .int(vintageMessage)
        .min(1000, vintageMessage)
        .max(9999, vintageMessage)
        .optional(),
    }),
  },
  travel: {
    label: '여행',
    subtypes: [],
    details: details('여행', {
      country: text('나라', 100).optional(),
      city: text('도시', 100).optional(),
    }),
  },
} satisfies Record<string, { label: string; subtypes: readonly string[]; details: z.ZodTypeAny }>;

const categoryMessage = '분야가 올바르지 않습니다';
const statusMessage = '상태는 하고 싶음(wishlist) 또는 완료(done)여야 합니다';
const costMessage = '비용은 0원 이상의 정수로 입력해 주세요';

const itemFields = z
  .object(
    {
      category: z.enum(['reading', 'screen', 'stage', 'drink', 'travel'], {
        errorMap: () => ({ message: categoryMessage }),
      }),
      subtype: text('세부 종류', 50).nullable().optional(),
      title: text('제목', 200),
      status: z
        .enum(['wishlist', 'done'], { errorMap: () => ({ message: statusMessage }) })
        .default('wishlist'),
      costKrw: z
        .number({ invalid_type_error: costMessage })
        .int(costMessage)
        .min(0, costMessage)
        .max(MAX_COST_KRW, `비용은 ${MAX_COST_KRW}원 이하로 입력해 주세요`)
        .nullable()
        .optional(),
      plannedDate: date('예정일').nullable().optional(),
      completedDate: date('완료일').nullable().optional(),
      details: z
        .record(z.string(), z.unknown(), {
          invalid_type_error: '분야별 정보 형식이 올바르지 않습니다',
        })
        .default({}),
    },
    {
      required_error: '요청 본문이 필요합니다',
      invalid_type_error: '요청 본문 형식이 올바르지 않습니다',
    },
  )
  .strict('알 수 없는 항목이 있습니다');

const itemPatch = itemFields.partial();

// Rules across fields. PATCH runs them on the merged row, so a partial change cannot break them.
function parseItem(input: unknown, today: string) {
  const item = itemFields.parse(input);
  const category = CATEGORIES[item.category];
  const subtype = item.subtype ?? null;
  const subtypes: readonly string[] = category.subtypes;
  if (subtypes.length === 0 && subtype !== null) {
    throw new HttpError(400, `${category.label} 분야에는 세부 종류를 넣을 수 없습니다`);
  }
  if (subtypes.length > 0 && (subtype === null || !subtypes.includes(subtype))) {
    throw new HttpError(400, `${category.label} 분야의 세부 종류가 올바르지 않습니다`);
  }
  const completedDate = item.completedDate ?? null;
  if (item.status === 'done' && completedDate === null) {
    throw new HttpError(400, '완료한 항목에는 완료일을 입력해 주세요');
  }
  if (item.status === 'wishlist' && completedDate !== null) {
    throw new HttpError(400, '완료하지 않은 항목에는 완료일을 넣을 수 없습니다');
  }
  if (completedDate !== null && completedDate > today) {
    throw new HttpError(400, '완료일은 오늘보다 뒤일 수 없습니다');
  }
  return {
    category: item.category,
    subtype,
    title: item.title,
    status: item.status,
    costKrw: item.costKrw ?? null,
    plannedDate: item.plannedDate ?? null,
    completedDate,
    details: category.details.parse(item.details) as Record<string, unknown>,
  };
}

const notFound = () => new HttpError(404, '항목을 찾을 수 없습니다');

export function createItemsRouter(pool: Pool, today: () => string) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM items ORDER BY created_at DESC, id DESC`,
    );
    res.json({ items: rows });
  });

  router.post('/', async (req, res) => {
    const item = parseItem(req.body, today());
    const { rows } = await pool.query(
      `INSERT INTO items
         (category, subtype, title, status, cost_krw, planned_date, completed_date, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      ],
    );
    res.status(201).json(rows[0]);
  });

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id, '항목');
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM items WHERE id = $1`, [id]);
    if (rows.length === 0) throw notFound();
    res.json(rows[0]);
  });

  router.patch('/:id', async (req, res) => {
    const id = parseId(req.params.id, '항목');
    const patch = itemPatch.parse(req.body);
    if (Object.keys(patch).length === 0) throw new HttpError(400, '수정할 내용이 없습니다');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: current } = await client.query(
        `SELECT ${COLUMNS} FROM items WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (current.length === 0) throw notFound();
      const { category, subtype, title, status, costKrw, plannedDate, completedDate, details } =
        current[0];
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
          ...patch,
        },
        today(),
      );
      const { rows } = await client.query(
        `UPDATE items
         SET category = $2, subtype = $3, title = $4, status = $5, cost_krw = $6,
             planned_date = $7, completed_date = $8, details = $9, updated_at = now()
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
        ],
      );
      await client.query('COMMIT');
      res.json(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  router.delete('/:id', async (req, res) => {
    const id = parseId(req.params.id, '항목');
    const { rowCount } = await pool.query('DELETE FROM items WHERE id = $1', [id]);
    if (rowCount === 0) throw notFound();
    res.status(204).end();
  });

  return router;
}
