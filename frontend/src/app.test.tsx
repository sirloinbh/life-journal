import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { findLive } from './test/live';

// The start page is the day log, which reads the list of entries too: that answer is an empty page.
const health = (body: object, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) =>
      Promise.resolve(
        path.startsWith('/api/journal?')
          ? new Response(JSON.stringify({ entries: [], nextOffset: null, total: 0 }))
          : new Response(JSON.stringify(body), { status }),
      ),
    ),
  );

test('shows the server date from /api/health on the overview', async () => {
  health({ today: '2026-10-26' });
  window.history.replaceState(null, '', '/dashboard');
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  expect(await screen.findByText('Server connected · 2026-10-26')).toBeInTheDocument();
});

test('reports a server error as an alert', async () => {
  health({ error: 'Cannot connect to the database' }, 503);
  render(<App />);
  expect(await findLive('alert')).toHaveTextContent('Cannot connect to the database');
});

test('a server that cannot be reached says so', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
  );
  render(<App />);
  expect(await findLive('alert')).toHaveTextContent('Cannot reach the server');
});

test.each([502, 504])('a proxy error page (HTML %i) shows its status', async (status) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(`<html><body>${status} Bad Gateway</body></html>`, {
          status,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    ),
  );
  render(<App />);
  expect(await findLive('alert')).toHaveTextContent(
    `Cannot check the server status (HTTP ${status})`,
  );
});

test('a 200 answer without the date is not reported as connected', async () => {
  health({});
  render(<App />);
  expect(await findLive('alert')).toHaveTextContent(/^Cannot check the server status$/);
  expect(screen.queryByText(/Server connected/)).toBeNull();
});

test('each page has its own address and is marked in the main menu', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Settings' }));
  expect(window.location.pathname).toBe('/settings');
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

// The server of the day log: the health check, an empty list of entries, and no entry on any day.
const dayLogApi = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) =>
      Promise.resolve(
        path === '/api/health'
          ? new Response(JSON.stringify({ today: '2026-10-26' }))
          : path.startsWith('/api/journal?')
            ? new Response(JSON.stringify({ entries: [], nextOffset: null, total: 0 }))
            : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
      ),
    ),
  );

test('an unknown address falls back to the day log, the start page', async () => {
  dayLogApi();
  window.history.replaceState(null, '', '/no-such-page');
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Day log' })).toBeInTheDocument();
  expect(window.location.pathname).toMatch(/^\/journal\/\d{4}-\d{2}-\d{2}$/);
});

test('the app opens on the day log and the menu follows the shared order (#235)', async () => {
  dayLogApi();
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Day log' })).toBeInTheDocument();
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  const labels = within(menu)
    .getAllByRole('link')
    .map((link) => link.textContent);
  expect(labels).toEqual([
    'Day log',
    'Week',
    '12 weeks',
    'Essays',
    'Bucket list',
    'Table view',
    'Calendar',
    'Statistics',
    'Study terms',
    'Dashboard',
    'Settings',
  ]);
});
