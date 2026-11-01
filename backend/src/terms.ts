import { Router } from 'express';
import type { Pool } from 'pg';

import { HttpError } from './standard/http.js';
import { TERM_DOMAINS, TERMS } from './terms-data.js';

const termIds = new Set(TERMS.map(({ id }) => id));

function knownTermId(id: string) {
  if (!termIds.has(id)) throw new HttpError(404, '용어를 찾을 수 없습니다');
  return id;
}

export function createTermsRouter(pool: Pool) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const { rows } = await pool.query<{ term_id: string }>('SELECT term_id FROM learned_terms');
    const learned = new Set(rows.map(({ term_id }) => term_id));
    res.json({
      domains: TERM_DOMAINS,
      terms: TERMS.map((term) => ({ ...term, learned: learned.has(term.id) })),
    });
  });

  router.put('/:id/learned', async (req, res) => {
    await pool.query(
      'INSERT INTO learned_terms (term_id) VALUES ($1) ON CONFLICT (term_id) DO NOTHING',
      [knownTermId(req.params.id)],
    );
    res.status(204).end();
  });

  router.delete('/:id/learned', async (req, res) => {
    await pool.query('DELETE FROM learned_terms WHERE term_id = $1', [knownTermId(req.params.id)]);
    res.status(204).end();
  });

  return router;
}
