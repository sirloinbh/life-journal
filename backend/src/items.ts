import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from './standard/http.js';

const MAX_COST_KRW = 2_147_483_647; // items.cost_krw is a PostgreSQL integer.

const COLUMNS = `id, category, subtype, title, status, cost_krw AS "costKrw",
  planned_date AS "plannedDate", completed_date AS "completedDate", details,
  rating::float8 AS rating, sub_ratings AS "subRatings", review, link,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

// PostgreSQL rejects NUL and lone surrogates inside jsonb, which would otherwise surface as a 500.
const isStorable = (value: string) => !value.includes('\0') && !/\p{Cs}/u.test(value);

const text = (label: string, max: number) =>
  z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? `${label}을(를) 입력해 주세요`
          : `${label}은(는) 문자로 입력해 주세요`,
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
    `${label} 정보에 없는 항목이 있습니다`,
    () => `${label} 정보 형식이 올바르지 않습니다`,
  );

const score = (label: string) => {
  const message = `${label}은(는) 0.5점부터 5점까지 0.5점 단위로 입력해 주세요`;
  return z
    .number({ error: message })
    .refine((value) => value >= 0.5 && value <= 5 && Number.isInteger(value * 2), message);
};

const criteria = (label: string, names: Record<string, string>) =>
  strictObject(
    Object.fromEntries(Object.entries(names).map(([key, name]) => [key, score(name).optional()])),
    `${label} 세부 평점에 없는 항목이 있습니다`,
    () => `${label} 세부 평점 형식이 올바르지 않습니다`,
  );

const MAX_REVIEW_LINES = 5;
const MAX_REVIEW_LENGTH = 500;

const reviewText = z
  .string({ error: '감상문은 문자로 입력해 주세요' })
  .transform((value) => value.replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n').trim())
  .refine(
    (value) => value.split('\n').length <= MAX_REVIEW_LINES,
    `감상문은 ${MAX_REVIEW_LINES}줄 이하로 입력해 주세요`,
  )
  .refine(
    (value) => value.length <= MAX_REVIEW_LENGTH,
    `감상문은 ${MAX_REVIEW_LENGTH}자 이하로 입력해 주세요`,
  )
  .refine(isStorable, '감상문에 사용할 수 없는 문자가 있습니다');

// The user opens this link in a browser, so only web addresses may reach an href. The server only stores it.
const isWebLink = (value: string) => {
  if (!/^https?:\/\/\S+$/i.test(value) || !isStorable(value)) return false;
  return URL.canParse(value);
};

const linkMessage = '링크는 http:// 또는 https://로 시작하는 주소로 입력해 주세요';

const linkText = z
  .string({ error: linkMessage })
  .trim()
  .max(2000, '링크는 2000자 이하로 입력해 주세요')
  .refine((value) => value === '' || isWebLink(value), linkMessage);

const vintageMessage = '빈티지는 4자리 연도로 입력해 주세요';

const CATEGORIES = {
  reading: {
    label: '독서',
    subtypes: [],
    details: details('독서', {
      author: text('저자', 100).optional(),
      publisher: text('출판사', 100).optional(),
    }),
    criteria: criteria('독서', { content: '내용', prose: '문장', afterglow: '여운' }),
  },
  screen: {
    label: '영화·드라마',
    subtypes: ['movie', 'drama'],
    details: details('영화·드라마', {
      director: text('감독', 100).optional(),
      cast: text('출연진', 200).optional(),
    }),
    criteria: criteria('영화·드라마', { story: '스토리', direction: '연출', acting: '연기' }),
  },
  stage: {
    label: '연극·공연·뮤지컬·오페라',
    subtypes: ['play', 'performance', 'musical', 'opera'],
    details: details('연극·공연·뮤지컬·오페라', {
      venue: text('공연장', 100).optional(),
      cast: text('출연진', 200).optional(),
    }),
    criteria: criteria('연극·공연·뮤지컬·오페라', {
      acting: '연기',
      direction: '연출',
      stage: '무대',
      music: '음악',
    }),
  },
  drink: {
    label: '와인·위스키·사케',
    subtypes: ['wine', 'whisky', 'sake'],
    details: details('와인·위스키·사케', {
      producer: text('생산자', 100).optional(),
      region: text('산지', 100).optional(),
      vintage: z
        .number({ error: vintageMessage })
        .refine((year) => Number.isInteger(year) && year >= 1000 && year <= 9999, vintageMessage)
        .optional(),
    }),
    criteria: criteria('와인·위스키·사케', {
      aroma: '향',
      taste: '맛',
      finish: '여운',
      value: '가성비',
    }),
  },
  travel: {
    label: '여행',
    subtypes: [],
    details: details('여행', {
      country: text('나라', 100).optional(),
      city: text('도시', 100).optional(),
    }),
    criteria: criteria('여행', {
      scenery: '풍경',
      food: '음식',
      lodging: '숙소',
      transport: '교통',
    }),
  },
} satisfies Record<
  string,
  {
    label: string;
    subtypes: readonly string[];
    details: z.ZodTypeAny;
    criteria: z.ZodTypeAny;
  }
>;

const categoryMessage = '분야가 올바르지 않습니다';
const statusMessage = '상태는 하고 싶음(wishlist) 또는 완료(done)여야 합니다';
const costMessage = '비용은 0원 이상의 정수로 입력해 주세요';

const status = z.enum(['wishlist', 'done'], { error: statusMessage });
const detailsRecord = z.record(z.string(), z.unknown(), {
  error: '분야별 정보 형식이 올바르지 않습니다',
});
const subRatingsRecord = z.record(z.string(), z.unknown(), {
  error: '세부 평점 형식이 올바르지 않습니다',
});

const itemShape = {
  category: z.enum(['reading', 'screen', 'stage', 'drink', 'travel'], {
    error: categoryMessage,
  }),
  subtype: text('세부 종류', 50).nullable().optional(),
  title: text('제목', 200),
  status,
  costKrw: z
    .number({ error: costMessage })
    .refine((cost) => Number.isInteger(cost) && cost >= 0, costMessage)
    .refine((cost) => cost <= MAX_COST_KRW, `비용은 ${MAX_COST_KRW}원 이하로 입력해 주세요`)
    .nullable()
    .optional(),
  plannedDate: date('예정일').nullable().optional(),
  completedDate: date('완료일').nullable().optional(),
  details: detailsRecord,
  rating: score('전체 평점').nullable().optional(),
  subRatings: subRatingsRecord,
  review: reviewText.nullable().optional(),
  link: linkText.nullable().optional(),
};

const itemObject = <Shape extends z.ZodRawShape>(shape: Shape) =>
  strictObject(shape, '알 수 없는 항목이 있습니다', (input) =>
    input === undefined ? '요청 본문이 필요합니다' : '요청 본문 형식이 올바르지 않습니다',
  );

const itemFields = itemObject({
  ...itemShape,
  status: status.default('wishlist'),
  details: detailsRecord.default({}),
  subRatings: subRatingsRecord.default({}),
});

// No defaults here: zod 4 applies a default inside .optional(), so PATCH would overwrite fields it did not get.
const itemPatch = itemObject(itemShape).partial();

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
  const rating = item.rating ?? null;
  const subRatings = category.criteria.parse(item.subRatings) as Record<string, unknown>;
  if (item.status === 'wishlist' && (rating !== null || Object.keys(subRatings).length > 0)) {
    throw new HttpError(400, '완료하지 않은 항목에는 평점을 넣을 수 없습니다');
  }
  const review = item.review || null;
  if (item.status === 'wishlist' && review !== null) {
    throw new HttpError(400, '완료하지 않은 항목에는 감상문을 넣을 수 없습니다');
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
  };
}

const notFound = () => new HttpError(404, '항목을 찾을 수 없습니다');

const SORT_COLUMNS = {
  title: 'title',
  // Menu order: the keys are English, so their alphabetical order means nothing on screen.
  category: "array_position(ARRAY['reading', 'screen', 'stage', 'drink', 'travel'], category)",
  status: 'status',
  costKrw: 'cost_krw',
  plannedDate: 'planned_date',
  completedDate: 'completed_date',
  rating: 'rating',
  createdAt: 'created_at',
};

const queryCost = (label: string) => {
  const message = `${label}은(는) ${MAX_COST_KRW}원 이하의 0 이상 정수로 입력해 주세요`;
  return z
    .string({ error: message })
    .refine((value) => /^\d{1,10}$/.test(value) && Number(value) <= MAX_COST_KRW, message)
    .transform(Number)
    .optional();
};

const queryDate = (label: string) => date(label).optional();

const listQuery = strictObject(
  {
    q: z
      .string({ error: '검색어는 하나만 입력해 주세요' })
      .trim()
      .max(100, '검색어는 100자 이하로 입력해 주세요')
      .refine(isStorable, '검색어에 사용할 수 없는 문자가 있습니다')
      .optional(),
    category: z
      .enum(['reading', 'screen', 'stage', 'drink', 'travel'], {
        error: categoryMessage,
      })
      .optional(),
    status: z.enum(['wishlist', 'done'], { error: statusMessage }).optional(),
    from: queryDate('시작일'),
    to: queryDate('종료일'),
    costMin: queryCost('최소 비용'),
    costMax: queryCost('최대 비용'),
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
        { error: '정렬 기준이 올바르지 않습니다' },
      )
      .default('createdAt'),
    order: z.enum(['asc', 'desc'], { error: '정렬 방향이 올바르지 않습니다' }).default('desc'),
  },
  '알 수 없는 검색 조건이 있습니다',
  () => '검색 조건 형식이 올바르지 않습니다',
);

function listSql(input: unknown) {
  const query = listQuery.parse(input);
  if (query.from && query.to && query.from > query.to) {
    throw new HttpError(400, '시작일은 종료일보다 뒤일 수 없습니다');
  }
  if (query.costMin !== undefined && query.costMax !== undefined && query.costMin > query.costMax) {
    throw new HttpError(400, '최소 비용은 최대 비용보다 클 수 없습니다');
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
  return {
    text: `SELECT ${COLUMNS} FROM items
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${SORT_COLUMNS[query.sort]} ${direction} NULLS LAST, id DESC`,
    params,
  };
}

export function createItemsRouter(pool: Pool, today: () => string) {
  const router = Router();

  router.get('/', async (req, res) => {
    const { text, params } = listSql(req.query);
    const { rows } = await pool.query(text, params);
    res.json({ items: rows });
  });

  router.post('/', async (req, res) => {
    const item = parseItem(req.body, today());
    const { rows } = await pool.query(
      `INSERT INTO items
         (category, subtype, title, status, cost_krw, planned_date, completed_date, details,
          rating, sub_ratings, review, link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
    // pg-pool stops listening while a client is checked out, and an unheard socket error would end
    // the process. The pending query still rejects, so the request answers with a 500.
    const onClientError = (error: Error) => {
      console.error(JSON.stringify({ event: 'db_client_error', message: error.message }));
    };
    client.on('error', onClientError);
    let connectionBroken = false;
    try {
      await client.query('BEGIN');
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
          ...patch,
        },
        today(),
      );
      const { rows } = await client.query(
        `UPDATE items
         SET category = $2, subtype = $3, title = $4, status = $5, cost_krw = $6,
             planned_date = $7, completed_date = $8, details = $9, rating = $10,
             sub_ratings = $11, review = $12, link = $13, updated_at = now()
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
        ],
      );
      await client.query('COMMIT');
      res.json(rows[0]);
    } catch (error) {
      // A failed ROLLBACK must not replace the error the client should see.
      await client.query('ROLLBACK').catch(() => {
        connectionBroken = true;
      });
      throw error;
    } finally {
      client.off('error', onClientError);
      client.release(connectionBroken);
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
