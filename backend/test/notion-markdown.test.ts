import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blocks, type NotionBlock, richText } from '../src/notion-markdown.js';
import { block, text } from './notion-fixtures.js';

const b = (...list: unknown[]) => list as NotionBlock[];

test('rich text keeps bold, italic, strikethrough, code, and links, with markers hugging the text', () => {
  assert.equal(
    richText([
      text('a '),
      text('bold ', { bold: true }),
      text('it', { italic: true }),
      text(' del', { strikethrough: true }),
      text('code', { code: true }),
      text('site', {}, 'https://example.com'),
    ]),
    'a **bold** *it* ~~del~~`code`[site](https://example.com)',
  );
});

test('code with backticks gets a longer fence, and a backslash in a table cell is escaped', () => {
  assert.equal(richText([text('a`b', { code: true })]), '``a`b``');
  assert.equal(richText([text('`x`', { code: true })]), '`` `x` ``');
  const table = block('t', 'table', {}, true);
  table.children = [
    { object: 'block', id: 'r', type: 'table_row', table_row: { cells: [[text('a\\|b')]] } },
  ] as NotionBlock[];
  assert.equal(blocks(b(table)), '| a\\\\\\|b |\n| --- |');
});

test('headings, lists, to-dos, and nested items become Markdown', () => {
  const nested = block('1', 'bulleted_list_item', { rich_text: [text('Tokyo')] }, true);
  nested.children = [block('2', 'bulleted_list_item', { rich_text: [text('Shibuya')] })];
  assert.equal(
    blocks(
      b(
        block('h', 'heading_2', { rich_text: [text('Title')] }),
        nested,
        block('3', 'numbered_list_item', { rich_text: [text('one')] }),
        block('4', 'numbered_list_item', { rich_text: [text('two')] }),
        block('5', 'to_do', { rich_text: [text('done')], checked: true }),
        block('6', 'paragraph', { rich_text: [text('end')] }),
      ),
    ),
    '## Title\n\n- Tokyo\n  - Shibuya\n1. one\n2. two\n- [x] done\n\nend',
  );
});

test('code, quote, divider, link, image, and table blocks', () => {
  const table = block('t', 'table', { has_column_header: true }, true);
  table.children = [
    {
      object: 'block',
      id: 'r1',
      type: 'table_row',
      table_row: { cells: [[text('A')], [text('B|C')]] },
    },
    {
      object: 'block',
      id: 'r2',
      type: 'table_row',
      table_row: { cells: [[text('1')], [text('2')]] },
    },
  ] as NotionBlock[];
  assert.equal(
    blocks(
      b(
        block('c', 'code', { rich_text: [text('x = 1')], language: 'python' }),
        block('q', 'quote', { rich_text: [text('said')] }),
        block('d', 'divider', {}),
        block('l', 'bookmark', { url: 'https://example.com', caption: [] }),
        block('i', 'image', {
          external: { url: 'https://example.com/a.png' },
          caption: [text('pic')],
        }),
        table,
        block('cp', 'child_page', { title: 'skipped' }),
      ),
    ),
    '```python\nx = 1\n```\n\n> said\n\n---\n\n[https://example.com](https://example.com)\n\n![pic](https://example.com/a.png)\n\n| A | B\\|C |\n| --- | --- |\n| 1 | 2 |',
  );
});

test('an unknown block type keeps its text instead of dropping it', () => {
  assert.equal(
    blocks(b(block('x', 'future_block', { rich_text: [text('still here')] }))),
    'still here',
  );
});
