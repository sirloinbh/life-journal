// #241: Notion blocks to Markdown. Pure functions: the importer fetches the blocks (with their children already
// attached as `children`) and this turns them into text. Block types without a good Markdown form are kept as
// a link or plain text; child pages and child databases are not written into the body, the tree shows them.

export type RichText = {
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
};

export type NotionBlock = {
  id: string;
  type: string;
  children?: NotionBlock[];
  // The payload sits under a key named after `type`.
  [key: string]: unknown;
};

type Payload = {
  rich_text?: RichText[];
  caption?: RichText[];
  checked?: boolean;
  language?: string;
  expression?: string;
  url?: string;
  external?: { url?: string };
  file?: { url?: string };
  icon?: { type?: string; emoji?: string };
  has_column_header?: boolean;
  title?: string;
};

export function richText(parts: RichText[] | undefined): string {
  return (parts ?? [])
    .map((part) => {
      let text = part.plain_text ?? '';
      if (text === '') return '';
      const a = part.annotations ?? {};
      if (a.code) text = `\`${text.replace(/`/g, '\\`')}\``;
      // Markers hug the text, not its surrounding spaces, so the result stays valid Markdown.
      const wrap = (marker: string) => {
        const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
        if (!match || match[2] === '') return;
        text = `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
      };
      if (a.strikethrough) wrap('~~');
      if (a.italic) wrap('*');
      if (a.bold) wrap('**');
      if (part.href) text = `[${text}](${part.href})`;
      return text;
    })
    .join('');
}

const payload = (block: NotionBlock): Payload => block[block.type] ?? {};

const indent = (text: string, spaces: number) =>
  text
    .split('\n')
    .map((line) => (line === '' ? line : ' '.repeat(spaces) + line))
    .join('\n');

const mediaUrl = (p: Payload) => p.external?.url ?? p.file?.url ?? p.url ?? '';

function tableRows(block: NotionBlock): string {
  const rows = (block.children ?? []).map((row) => {
    const cells = ((row.table_row as { cells?: RichText[][] } | undefined)?.cells ?? []).map(
      (cell) => richText(cell).replace(/\|/g, '\\|').replace(/\n/g, ' '),
    );
    return `| ${cells.join(' | ')} |`;
  });
  if (rows.length === 0) return '';
  const width = Math.max(1, (rows[0].match(/ \| /g)?.length ?? 0) + 1);
  const separator = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`;
  // Markdown tables need a header row; without a Notion header the first row stands in.
  return [rows[0], separator, ...rows.slice(1)].join('\n');
}

function one(block: NotionBlock, number: number): string {
  const p = payload(block);
  const text = richText(p.rich_text);
  const kids = block.children ?? [];
  const nested = (spaces: number) => {
    const inner = blocks(kids);
    return inner === '' ? '' : `\n${indent(inner, spaces)}`;
  };
  switch (block.type) {
    case 'paragraph':
      return text + (kids.length > 0 ? `\n\n${blocks(kids)}` : '');
    case 'heading_1':
      return `# ${text}`;
    case 'heading_2':
      return `## ${text}`;
    case 'heading_3':
      return `### ${text}`;
    case 'bulleted_list_item':
      return `- ${text}${nested(2)}`;
    case 'numbered_list_item':
      return `${number}. ${text}${nested(3)}`;
    case 'to_do':
      return `- [${p.checked ? 'x' : ' '}] ${text}${nested(2)}`;
    case 'toggle':
      return `- ${text}${nested(2)}`;
    case 'quote':
      return `${`> ${text}`.replace(/\n/g, '\n> ')}${kids.length > 0 ? `\n>\n${blocks(kids).replace(/^/gm, '> ')}` : ''}`;
    case 'callout': {
      const icon = p.icon?.type === 'emoji' && p.icon.emoji ? `${p.icon.emoji} ` : '';
      return `> ${icon}${text}`.replace(/\n/g, '\n> ');
    }
    case 'code': {
      const language = p.language && p.language !== 'plain text' ? p.language : '';
      const code = (p.rich_text ?? []).map((part) => part.plain_text ?? '').join('');
      const fence = code.includes('```') ? '~~~' : '```';
      return `${fence}${language}\n${code}\n${fence}`;
    }
    case 'divider':
      return '---';
    case 'equation':
      return `$$\n${p.expression ?? ''}\n$$`;
    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const url = p.url ?? '';
      return url ? `[${richText(p.caption) || url}](${url})` : '';
    }
    case 'image': {
      const url = mediaUrl(p);
      return url ? `![${richText(p.caption)}](${url})` : '';
    }
    case 'file':
    case 'pdf':
    case 'video':
    case 'audio': {
      const url = mediaUrl(p);
      return url ? `[${richText(p.caption) || block.type}](${url})` : '';
    }
    case 'table':
      return tableRows(block);
    case 'column_list':
    case 'column':
    case 'synced_block':
      return blocks(kids);
    case 'link_to_page':
      return '';
    case 'child_page':
    case 'child_database':
    case 'table_of_contents':
    case 'breadcrumb':
      return '';
    default:
      // An unknown block type keeps its text, so nothing written in Notion is silently lost.
      return text + (kids.length > 0 ? `\n\n${blocks(kids)}` : '');
  }
}

const isListItem = (type: string) =>
  type === 'bulleted_list_item' ||
  type === 'numbered_list_item' ||
  type === 'to_do' ||
  type === 'toggle';

/** The Markdown of a list of sibling blocks: list items stay together, other blocks are separated by a blank line. */
export function blocks(list: NotionBlock[]): string {
  const out: string[] = [];
  let number = 0;
  let previous = '';
  for (const block of list) {
    number = block.type === 'numbered_list_item' ? number + 1 : 0;
    const text = one(block, number);
    if (text === '' && !['paragraph'].includes(block.type)) continue;
    const joinTight = isListItem(block.type) && isListItem(previous);
    out.push(out.length === 0 ? text : `${joinTight ? '\n' : '\n\n'}${text}`);
    previous = block.type;
  }
  return out.join('').trim();
}
