import express from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { types } from 'pg';

import { createItemsRouter } from './items.js';
import { errorHandler, notFound } from './standard/http.js';
import { createTermsRouter } from './terms.js';

// DATE columns stay YYYY-MM-DD strings so the service time zone never shifts them.
types.setTypeParser(1082, (value) => value);
// BIGINT ids stay JSON numbers: parseId only accepts ids that a JS number holds exactly.
types.setTypeParser(20, Number);

const serviceTimeZone = 'Asia/Seoul';

// "Today" follows the service time zone, not the server clock's zone.
export function serviceDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: serviceTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function createApp(pool: Pool, options: { today?: () => string } = {}) {
  const today = options.today ?? (() => serviceDate());
  const app = express();
  app.disable('x-powered-by');
  // Same level as the /api/ limit in frontend/nginx.conf (10 r/s), for paths that skip nginx.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요' },
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'life-journal', today: today() });
  });
  app.use('/api/items', createItemsRouter(pool, today));
  app.use('/api/terms', createTermsRouter(pool));
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
