import { meHandler } from '@sirloinbh/auth-client';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { types } from 'pg';

import { createItemsRouter } from './items.js';
import { setInt8Parser } from './standard/db.js';
import { errorHandler, notFound, requestLog } from './standard/http.js';
import { createTermsRouter } from './terms.js';

// DATE columns stay YYYY-MM-DD strings so the service time zone never shifts them.
types.setTypeParser(1082, (value) => value);
// BIGINT ids come back as JS numbers; a value a number cannot hold exactly throws (ADR-0025).
setInt8Parser(types);

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

export function createApp(
  pool: Pool,
  options: { today?: () => string; auth?: express.RequestHandler } = {},
) {
  const today = options.today ?? (() => serviceDate());
  const app = express();
  app.disable('x-powered-by');
  // project-standards#658: a request ID and one JSON log line for every request, first so a 401 has them too.
  app.use(requestLog);
  // Same level as the /api/ limit in frontend/nginx.conf (10 r/s), for paths that skip nginx.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later' },
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  // #111: the shared sign-in guards every /api route except /api/health, before any route registers.
  if (options.auth) app.use('/api', options.auth);
  app.get('/api/me', meHandler);
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
