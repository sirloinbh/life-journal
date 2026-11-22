import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { findLive } from './test/live';

const health = (body: object, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );

test('shows the server date from /api/health on the overview', async () => {
  health({ today: '2026-10-26' });
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

test('an unknown address falls back to the overview', async () => {
  health({ today: '2026-10-26' });
  window.history.replaceState(null, '', '/no-such-page');
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});
