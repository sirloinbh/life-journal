import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Markdown } from './markdown';

test('headings, paragraphs, lists, quotes, and code blocks become elements', () => {
  render(
    <Markdown
      text={[
        '# Title',
        '## Part',
        'First line',
        'second line',
        '',
        '- one',
        '- two',
        '',
        '1. first',
        '2. second',
        '',
        '> quoted',
        '',
        '```',
        'const a = 1;',
        '```',
      ].join('\n')}
    />,
  );
  expect(screen.getByRole('heading', { level: 2, name: 'Title' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3, name: 'Part' })).toBeInTheDocument();
  expect(screen.getAllByRole('list')).toHaveLength(2);
  expect(screen.getAllByRole('listitem')).toHaveLength(4);
  expect(screen.getByText('quoted')).toBeInTheDocument();
  expect(screen.getByText('const a = 1;')).toBeInTheDocument();
});

test('inline bold, italic, code, and web links work; other links stay text', () => {
  render(
    <Markdown text="A **bold** and *slanted* and `code` with [a site](https://example.com) and [bad](javascript:alert(1))" />,
  );
  expect(screen.getByText('bold').tagName).toBe('STRONG');
  expect(screen.getByText('slanted').tagName).toBe('EM');
  expect(screen.getByText('code').tagName).toBe('CODE');
  expect(screen.getByRole('link', { name: 'a site' })).toHaveAttribute(
    'href',
    'https://example.com',
  );
  expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
});

test('typed markup is shown as text, never added to the page', () => {
  const { container } = render(
    <Markdown text={'<script>alert(1)</script> <img src=x onerror=alert(1)>'} />,
  );
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('img')).toBeNull();
  expect(container).toHaveTextContent('<script>alert(1)</script>');
});
