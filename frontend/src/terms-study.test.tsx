import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { json, openAt } from './test/app';
import { findLive, queryLive } from './test/live';

// `original` comes only when it differs from the name; Montage's copy checks the screen still
// prints the name once if the server sends one (#147).
const TERMS = [
  { id: 'wine-tannin', domain: 'wine', term: 'Tannin', meaning: 'An astringent compound' },
  {
    id: 'wine-terroir',
    domain: 'wine',
    term: 'Terroir',
    original: 'Le terroir',
    meaning: 'The growing environment',
  },
  {
    id: 'movie-montage',
    domain: 'movie',
    term: 'Montage',
    original: 'Montage',
    meaning: 'Editing',
  },
  { id: 'opera-aria', domain: 'opera', term: 'Aria', meaning: 'A solo song' },
  { id: 'musical-number', domain: 'musical', term: 'Number', meaning: 'A song' },
];

// An in-memory API. Its learned marks outlive a render, like the server's do across a reload.
function fakeApi() {
  const api = {
    learned: new Set<string>(),
    requests: [] as { method: string; path: string }[],
    failNext: null as { status: number; error: string } | null,
    failList: false,
    changeGate: null as Promise<void> | null,
    holdNextList: null as Promise<void> | null,
    // Set once the screen has read the body of a held list, so a test knows that answer arrived.
    heldListRead: false,
    lists: 0,
    terms: [...TERMS],
    domains: [
      { key: 'wine', label: 'Wine' },
      { key: 'movie', label: 'Movie' },
      { key: 'opera', label: 'Opera' },
      { key: 'musical', label: 'Musical' },
    ],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: { method?: string } = {}) => {
      const method = init.method ?? 'GET';
      if (path === '/api/health') return json({ today: '2026-11-02' });
      if (method === 'GET') {
        if (api.failList) return json({ error: 'A server error occurred' }, 500);
        // A held list answers with what was true when it was asked.
        const answer = json({
          domains: api.domains,
          terms: api.terms.map((term) => ({ ...term, learned: api.learned.has(term.id) })),
        });
        api.lists++;
        const hold = api.holdNextList;
        api.holdNextList = null;
        if (!hold) return answer;
        await hold;
        const read = answer.json.bind(answer);
        answer.json = async () => {
          const body: unknown = await read();
          api.heldListRead = true;
          return body;
        };
        return answer;
      }
      api.requests.push({ method, path });
      if (api.changeGate) await api.changeGate;
      if (api.failNext) {
        const { status, error } = api.failNext;
        api.failNext = null;
        return json({ error }, status);
      }
      const id = path.split('/')[3];
      if (method === 'PUT') api.learned.add(id);
      else api.learned.delete(id);
      return json(undefined, 204);
    }),
  );
  return api;
}

const box = (name: string) => screen.findByRole('checkbox', { name });

test('the main menu leads to the first domain', async () => {
  fakeApi();
  openAt('/');
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Study terms' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Study terms' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { level: 2, name: /Tannin/ })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/terms/wine');
});

test('an unknown domain in the address goes to the first domain', async () => {
  fakeApi();
  openAt('/terms/no-such-domain');
  expect(await screen.findByRole('heading', { level: 2, name: /Tannin/ })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/terms/wine');
});

test('a domain shows only its own terms, with the original word and meaning', async () => {
  fakeApi();
  openAt('/terms/wine');
  expect(await screen.findByRole('heading', { level: 2, name: /Tannin/ })).toHaveTextContent(
    /^Tannin$/,
  );
  expect(screen.getByRole('heading', { level: 2, name: /Terroir/ })).toHaveTextContent(
    /^TerroirLe terroir$/,
  );
  expect(screen.getByText('An astringent compound')).toBeInTheDocument();
  expect(screen.queryByText('Aria')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Opera' }));
  expect(await screen.findByRole('heading', { level: 2, name: /Aria/ })).toBeInTheDocument();
  expect(screen.queryByText('Tannin')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/terms/opera');
});

// #73 fills three domains on the stage and screen; each shows its own terms only.
test.each([
  ['movie', 'Movie', 'Montage'],
  ['opera', 'Opera', 'Aria'],
  ['musical', 'Musical', 'Number'],
])('the %s domain shows its own term', async (key, label, term) => {
  fakeApi();
  openAt('/terms/wine');
  await box('Tannin learned');
  fireEvent.click(screen.getByRole('link', { name: label }));
  expect(
    await screen.findByRole('heading', { level: 2, name: new RegExp(term) }),
  ).toBeInTheDocument();
  const others = ['Tannin', 'Montage', 'Aria', 'Number'].filter((name) => name !== term);
  for (const name of others) {
    expect(
      screen.queryByRole('heading', { level: 2, name: new RegExp(name) }),
    ).not.toBeInTheDocument();
  }
  expect(window.location.pathname).toBe(`/terms/${key}`);
});

test.each([
  ['the term', 'Terroir'],
  ['the original word in any case', 'lE TERR'],
  ['the meaning', 'growing'],
  ['a word with spaces around it', '  Terroir  '],
])('search finds a term by %s', async (_name, search) => {
  fakeApi();
  openAt('/terms/wine');
  await box('Tannin learned');
  fireEvent.change(screen.getByLabelText('Search terms'), { target: { value: search } });
  expect(screen.getByRole('heading', { level: 2, name: /Terroir/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 2, name: /Tannin/ })).not.toBeInTheDocument();
});

test('a search without results says so, and another domain starts without the search', async () => {
  fakeApi();
  openAt('/terms/wine');
  await box('Tannin learned');
  // A term of another domain is not a result here.
  fireEvent.change(screen.getByLabelText('Search terms'), { target: { value: 'Aria' } });
  expect(screen.getByText('No results')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Opera' }));
  expect(await screen.findByLabelText('Search terms')).toHaveValue('');
  expect(screen.getByRole('heading', { level: 2, name: /Aria/ })).toBeInTheDocument();
});

test('a learned mark stays after a reload and can be taken back', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  fireEvent.click(await box('Tannin learned'));
  await waitFor(async () => expect(await box('Tannin learned')).toBeChecked());
  expect(api.requests).toEqual([{ method: 'PUT', path: '/api/terms/wine-tannin/learned' }]);
  expect(screen.getByText('Wine · 1/2 terms learned')).toBeInTheDocument();

  cleanup();
  openAt('/terms/wine');
  expect(await box('Tannin learned')).toBeChecked();
  expect(await box('Terroir learned')).not.toBeChecked();

  fireEvent.click(await box('Tannin learned'));
  await waitFor(async () => expect(await box('Tannin learned')).not.toBeChecked());
  expect(api.requests.at(-1)).toEqual({
    method: 'DELETE',
    path: '/api/terms/wine-tannin/learned',
  });
  expect(screen.getByText('Wine · 0/2 terms learned')).toBeInTheDocument();
});

test('a failed mark shows the message and leaves the box as it was', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  api.failNext = { status: 500, error: 'A server error occurred' };
  fireEvent.click(tannin);
  expect(await findLive('alert')).toHaveTextContent('Tannin: A server error occurred');
  expect(tannin).not.toBeChecked();
  fireEvent.click(tannin);
  await waitFor(() => expect(tannin).toBeChecked());
  expect(queryLive('alert')).toBeNull();
});

test('a mark failing after a move to another domain names its term there', async () => {
  const api = fakeApi();
  let open = () => {};
  api.changeGate = new Promise((resolve) => {
    open = resolve;
  });
  api.failNext = { status: 500, error: 'A server error occurred' };
  openAt('/terms/wine');
  fireEvent.click(await box('Tannin learned'));
  fireEvent.click(screen.getByRole('link', { name: 'Opera' }));
  await box('Aria learned');
  await act(async () => {
    open();
    await api.changeGate;
  });
  expect(await findLive('alert')).toHaveTextContent('Tannin: A server error occurred');
});

test('more clicks during a mark on its way send nothing and keep the keyboard focus', async () => {
  const api = fakeApi();
  let open = () => {};
  api.changeGate = new Promise((resolve) => {
    open = resolve;
  });
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  tannin.focus();
  fireEvent.click(tannin);
  fireEvent.click(tannin);
  // A mutation starts its request a microtask after the click (#158), so let that happen first.
  await act(async () => {});
  expect(api.requests).toHaveLength(1);
  expect(tannin).toBeEnabled();
  expect(tannin).toHaveFocus();
  await act(async () => {
    open();
    await api.changeGate;
  });
  await waitFor(() => expect(tannin).toBeChecked());
  expect(api.requests).toHaveLength(1);
});

test('a term gone from the server is reported and leaves the list', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  api.failNext = { status: 404, error: 'Term not found' };
  api.terms = api.terms.filter(({ id }) => id !== 'wine-tannin');
  fireEvent.click(tannin);
  expect(await findLive('alert')).toHaveTextContent('Term not found');
  await waitFor(() => expect(screen.queryByText('Tannin')).not.toBeInTheDocument());
});

test('a mark confirmed during a list on its way keeps both the mark and the refresh', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  const terroir = await box('Terroir learned');
  let open = () => {};
  api.holdNextList = new Promise((resolve) => {
    open = resolve;
  });
  api.failNext = { status: 404, error: 'Term not found' };
  api.terms = api.terms.filter(({ id }) => id !== 'wine-tannin');
  fireEvent.click(tannin);
  expect(await findLive('alert')).toHaveTextContent('Term not found');

  // The held list was read before this mark, so the mark asks for a newer one.
  fireEvent.click(terroir);
  await waitFor(() => expect(api.lists).toBe(3));
  // Tannin leaves only with the newer list: the held one has not answered yet.
  await waitFor(() => expect(screen.queryByText('Tannin')).not.toBeInTheDocument());
  expect(await box('Terroir learned')).toBeChecked();
  expect(api.heldListRead).toBe(false);

  // #154: wait until the screen has read the stale answer and let it settle before checking that
  // it changed nothing.
  open();
  await waitFor(() => expect(api.heldListRead).toBe(true));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(await box('Terroir learned')).toBeChecked();
  expect(screen.getByText('Wine · 1/1 terms learned')).toBeInTheDocument();
});

test('a message about a mark goes away on another domain', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  api.failNext = { status: 500, error: 'A server error occurred' };
  fireEvent.click(tannin);
  expect(await findLive('alert')).toHaveTextContent('A server error occurred');
  fireEvent.click(screen.getByRole('link', { name: 'Opera' }));
  await box('Aria learned');
  await waitFor(() => expect(queryLive('alert')).toBeNull());
});

test('a failed list can be tried again', async () => {
  const api = fakeApi();
  api.failList = true;
  openAt('/terms/wine');
  expect(await screen.findByText('A server error occurred')).toBeInTheDocument();
  api.failList = false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { level: 2, name: /Tannin/ })).toBeInTheDocument();
});

test('a failed refresh keeps the terms on screen, says so, and can be tried again', async () => {
  const api = fakeApi();
  openAt('/terms/wine');
  const tannin = await box('Tannin learned');
  api.failNext = { status: 404, error: 'Term not found' };
  api.terms = api.terms.filter(({ id }) => id !== 'wine-tannin');
  api.failList = true;
  fireEvent.click(tannin);
  expect(await screen.findByText('Tannin: Term not found')).toBeInTheDocument();
  expect(
    (await screen.findByText('A server error occurred')).closest('[role="alert"]'),
  ).not.toBeNull();
  expect(await box('Terroir learned')).toBeInTheDocument();

  api.failList = false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByText('Tannin')).not.toBeInTheDocument());
  expect(screen.queryByText('A server error occurred')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
});

// #151: a server with no domains has no tab to open, so the page says so instead of going blank.
test.each(['/terms', '/terms/wine'])('no domains at %s shows an empty state', async (path) => {
  const api = fakeApi();
  api.domains = [];
  api.terms = [];
  openAt(path);
  expect(await screen.findByText('No terms yet')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Study terms' })).toBeInTheDocument();
  expect(window.location.pathname).toBe(path);
});

// #147: an original name that only repeats the term is not printed a second time.
test('a term card reads its name once when the original is the same', async () => {
  fakeApi();
  openAt('/terms/movie');
  expect(await screen.findByRole('heading', { level: 2, name: /Montage/ })).toHaveTextContent(
    /^Montage$/,
  );
});

// #218: a quiz shows a meaning and asks for the term among terms of the same domain.
const quizMode = async () => fireEvent.click(await screen.findByRole('radio', { name: 'Quiz' }));
const quizTitle = 'Which Wine term has this meaning?';

function getStatus() {
  const quiz = screen
    .getByRole('heading', { level: 2, name: /term has this meaning/ })
    .closest('[data-slot="card"]');
  return within(quiz as HTMLElement).getByRole('status');
}

test('a wrong answer shows the right term, and the term can be marked as learned from the quiz', async () => {
  const api = fakeApi();
  // Terroir is learned, so Tannin, the only unlearned wine term, is asked.
  api.learned.add('wine-terroir');
  openAt('/terms/wine');
  await quizMode();
  expect(await screen.findByRole('heading', { level: 2, name: quizTitle })).toBeInTheDocument();
  expect(screen.getByText('An astringent compound')).toBeInTheDocument();
  const choices = within(screen.getByRole('list', { name: quizTitle })).getAllByRole('button');
  expect(choices.map((choice) => choice.textContent).sort()).toEqual(['Tannin', 'Terroir']);

  const wrong = screen.getByRole('button', { name: 'Terroir' });
  wrong.focus();
  fireEvent.click(wrong);
  expect(getStatus()).toHaveTextContent('Not quite. The answer is Tannin.');
  expect(screen.getByRole('button', { name: 'Terroir (your pick)' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Terroir (your pick)' })).toHaveFocus();
  // Another click after the answer changes nothing.
  fireEvent.click(screen.getByRole('button', { name: 'Tannin (answer)' }));
  expect(getStatus()).toHaveTextContent('Not quite.');
  expect(screen.getByText('0/1 right')).toBeInTheDocument();

  const mark = screen.getByRole('button', { name: 'Mark Tannin as learned' });
  mark.focus();
  fireEvent.click(mark);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Tannin is learned' })).toHaveAttribute(
      'aria-disabled',
      'true',
    ),
  );
  expect(screen.getByRole('button', { name: 'Tannin is learned' })).toHaveFocus();
  expect(api.requests).toEqual([{ method: 'PUT', path: '/api/terms/wine-tannin/learned' }]);
  // The question stays after the mark.
  expect(screen.getByText('An astringent compound')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: 'List' }));
  expect(await box('Tannin learned')).toBeChecked();
  expect(screen.getByText('Wine · 2/2 terms learned')).toBeInTheDocument();
});

test('a right answer says so, counts it, and the next question starts unanswered', async () => {
  const api = fakeApi();
  api.learned.add('wine-terroir');
  openAt('/terms/wine');
  await quizMode();
  fireEvent.click(await screen.findByRole('button', { name: 'Tannin' }));
  expect(getStatus()).toHaveTextContent('Right: Tannin.');
  expect(screen.getByText('1/1 right')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
  expect(getStatus()).toHaveTextContent('');
  expect(screen.getByRole('button', { name: 'Tannin' })).not.toHaveAttribute('aria-disabled');
  expect(screen.queryByRole('button', { name: /Mark .* as learned/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  expect(api.requests).toEqual([]);
});

test('a failed mark from the quiz shows the message and keeps the button', async () => {
  const api = fakeApi();
  api.learned.add('wine-terroir');
  openAt('/terms/wine');
  await quizMode();
  fireEvent.click(await screen.findByRole('button', { name: 'Tannin' }));
  api.failNext = { status: 500, error: 'A server error occurred' };
  fireEvent.click(screen.getByRole('button', { name: 'Mark Tannin as learned' }));
  expect(await findLive('alert')).toHaveTextContent('Tannin: A server error occurred');
  expect(screen.getByRole('button', { name: 'Mark Tannin as learned' })).not.toHaveAttribute(
    'aria-disabled',
  );
});

test('the quiz mode stays on another domain, which asks its own terms', async () => {
  const api = fakeApi();
  api.terms.push(
    { id: 'opera-libretto', domain: 'opera', term: 'Libretto', meaning: 'The text' },
    { id: 'opera-overture', domain: 'opera', term: 'Overture', meaning: 'The opening' },
  );
  openAt('/terms/wine');
  await quizMode();
  await screen.findByRole('heading', { level: 2, name: quizTitle });
  fireEvent.click(screen.getByRole('link', { name: 'Opera' }));
  const title = 'Which Opera term has this meaning?';
  expect(await screen.findByRole('heading', { level: 2, name: title })).toBeInTheDocument();
  const choices = within(screen.getByRole('list', { name: title })).getAllByRole('button');
  expect(choices.map((choice) => choice.textContent).sort()).toEqual([
    'Aria',
    'Libretto',
    'Overture',
  ]);
  expect(screen.getByRole('radio', { name: 'Quiz' })).toBeChecked();
});

test('a domain with one term says there are not enough terms for a quiz', async () => {
  fakeApi();
  openAt('/terms/movie');
  await quizMode();
  expect(await screen.findByText('Not enough terms for a quiz')).toBeInTheDocument();
});

test('the quiz meaning hides the name of the term it asks for', async () => {
  const api = fakeApi();
  api.learned.add('wine-terroir');
  api.terms = api.terms.map((term) =>
    term.id === 'wine-tannin' ? { ...term, meaning: 'Tannin makes a wine astringent.' } : term,
  );
  openAt('/terms/wine');
  await quizMode();
  expect(await screen.findByText('(this term) makes a wine astringent.')).toBeInTheDocument();
});
