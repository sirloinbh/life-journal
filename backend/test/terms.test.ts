import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { TERM_DOMAINS, TERMS } from '../src/terms-data.js';
import { withApi } from './helpers.js';

const noDatabase = {
  query: () => Promise.reject(new Error('No query is expected')),
} as unknown as Pool;

test('every term has a unique id, belongs to a domain and has text in every field', () => {
  assert.equal(new Set(TERMS.map(({ id }) => id)).size, TERMS.length);
  const domains = new Set<string>(TERM_DOMAINS.map(({ key }) => key));
  for (const term of TERMS) {
    assert.ok(domains.has(term.domain), term.id);
    assert.match(term.id, new RegExp(`^${term.domain}-[a-z0-9-]+$`));
    assert.ok(term.term.trim() && term.meaning.trim(), term.id);
  }
});

// #147: a card prints `original` next to `term`, so a copy of the name would show it twice.
test('an original name is given only when it differs from the term', () => {
  for (const term of TERMS) {
    if (term.original === undefined) continue;
    assert.ok(term.original.trim(), term.id);
    assert.notEqual(term.original.trim().toLowerCase(), term.term.trim().toLowerCase(), term.id);
  }
});

// #148: a learned mark is stored by term id, and the list ignores ids it does not know, so a renamed
// or removed id would silently lose its marks. Every id is pinned in term-ids.txt.
test('every term id is pinned, and none is renamed or removed', () => {
  const pinned = readFileSync(new URL('term-ids.txt', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'));
  const ids = new Set(TERMS.map(({ id }) => id));
  const missing = pinned.filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], 'renamed or removed ids: learned marks would be lost');
  const unpinned = [...ids].filter((id) => !pinned.includes(id));
  assert.deepEqual(unpinned, [], 'new ids: add them to backend/test/term-ids.txt');
  assert.equal(new Set(pinned).size, pinned.length, 'an id is pinned twice');
});

test('a term name appears only once in its domain', () => {
  const names = TERMS.map(({ domain, term }) => `${domain}:${term}`);
  assert.equal(new Set(names).size, names.length);
});

// The filled domains (#70 wine, #71 whisky, #72 literature, #73 movie, opera and musical): how
// many terms each has, its ranges in list order with one sample term each, and the ids from #69
// that saved learned marks may point to.
const FILLED_DOMAINS = {
  wine: {
    count: 50,
    ranges: {
      Grapes: 'wine-cabernet-sauvignon',
      Regions: 'wine-bordeaux',
      Winemaking: 'wine-malolactic-fermentation',
      Tasting: 'wine-finish',
    },
    kept: ['wine-tannin', 'wine-terroir'],
  },
  whisky: {
    count: 50,
    ranges: {
      Types: 'whisky-bourbon',
      Regions: 'whisky-islay',
      'Distilling and aging': 'whisky-pot-still',
      'Tasting and drinking': 'whisky-peaty',
    },
    kept: ['whisky-single-malt', 'whisky-cask-strength'],
  },
  literature: {
    count: 50,
    ranges: {
      Genres: 'literature-short-story',
      Narration: 'literature-omniscient',
      Structure: 'literature-climax',
      Rhetoric: 'literature-metaphor',
    },
    kept: ['literature-foreshadowing', 'literature-point-of-view'],
  },
  movie: {
    count: 50,
    ranges: {
      Shooting: 'movie-close-up',
      Editing: 'movie-cross-cutting',
      'Direction and story': 'movie-macguffin',
      'Sound and production': 'movie-foley',
    },
    kept: ['movie-mise-en-scene', 'movie-montage'],
  },
  opera: {
    count: 50,
    ranges: {
      Voices: 'opera-soprano',
      Forms: 'opera-overture',
      'Stage and performance': 'opera-surtitles',
      'Genres and movements': 'opera-verismo',
    },
    kept: ['opera-aria', 'opera-recitative'],
  },
  musical: {
    count: 50,
    ranges: {
      Numbers: 'musical-reprise',
      Stage: 'musical-turntable',
      'Roles and viewing': 'musical-swing',
      'Production and genres': 'musical-jukebox-musical',
    },
    kept: ['musical-number', 'musical-ensemble'],
  },
};

test('every domain is filled', () => {
  assert.deepEqual(
    Object.keys(FILLED_DOMAINS),
    TERM_DOMAINS.map(({ key }) => key),
  );
});

for (const [domain, { count, ranges, kept }] of Object.entries(FILLED_DOMAINS)) {
  test(`the ${domain} domain has ${count} terms in its ranges, each range in one block`, () => {
    const terms = TERMS.filter((term) => term.domain === domain);
    assert.equal(terms.length, count);
    // Ranges in the order they first appear; a range that comes back later would show twice.
    const blocks = terms
      .map(({ range }) => range)
      .filter((range, index, all) => index === 0 || all[index - 1] !== range);
    assert.deepEqual(blocks, Object.keys(ranges));
    for (const [range, id] of Object.entries(ranges)) {
      assert.equal(terms.find((term) => term.id === id)?.range, range, id);
    }
  });

  test(`the ${domain} ids that saved learned marks may point to are kept`, () => {
    const ids = new Set(TERMS.map(({ id }) => id));
    for (const id of kept) assert.ok(ids.has(id), id);
  });
}

test('the term list sends every filled domain with its learned marks', async () => {
  const pool = {
    query: () =>
      Promise.resolve({ rows: [{ term_id: 'wine-pinot-noir' }, { term_id: 'whisky-islay' }] }),
  } as unknown as Pool;
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/terms');
    assert.equal(status, 200);
    const terms = data.terms as { id: string; domain: string; learned: boolean }[];
    for (const [domain, { count }] of Object.entries(FILLED_DOMAINS)) {
      assert.equal(terms.filter((term) => term.domain === domain).length, count, domain);
    }
    assert.deepEqual(
      terms.filter(({ learned }) => learned).map(({ id }) => id),
      ['wine-pinot-noir', 'whisky-islay'],
    );
  });
});

for (const method of ['PUT', 'DELETE']) {
  for (const id of ['no-such-term', '__proto__', 'wine-tannin%00']) {
    test(`${method} on the unknown term ${id} is a 404`, async () => {
      await withApi(noDatabase, async (call) => {
        const { status, data } = await call(`/api/terms/${id}/learned`, { method });
        assert.equal(status, 404);
        assert.equal(data.error, 'Term not found');
      });
    });
  }
}
