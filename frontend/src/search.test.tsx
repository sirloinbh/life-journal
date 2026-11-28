import { fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { json, openAt } from './test/app';

// #277: the top bar search finds this app's records and opens the one the owner picks.
afterEach(() => {
  vi.unstubAllGlobals();
});

test('a word from a saved record shows the record in the search and opens it', async () => {
  const asked: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      asked.push(path);
      if (path === '/api/health') return Promise.resolve(json({ today: '2026-11-10' }));
      if (path.startsWith('/api/search?')) {
        return Promise.resolve(
          json({
            results: [
              {
                title: 'Morning walk',
                href: '/essays/7',
                kind: 'content',
                snippet: 'A walk with zebra stripes',
              },
            ],
          }),
        );
      }
      return Promise.resolve(json({}));
    }),
  );
  openAt('/dashboard');
  fireEvent.click(await screen.findByRole('button', { name: 'Search this app' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Search this app' }), {
    target: { value: 'zebra' },
  });
  const option = await screen.findByRole('option', { name: /Morning walk/ }, { timeout: 2000 });
  expect(asked).toContain('/api/search?q=zebra');
  expect(option).toHaveTextContent('A walk with zebra stripes');
  expect(screen.getByRole('group', { name: 'Content' })).toBeInTheDocument();
  fireEvent.click(option);
  expect(window.location.pathname).toBe('/essays/7');
});
