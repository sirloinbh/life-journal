import type { ReactNode } from 'react';

// #239: a small Markdown preview for the essay editor. It supports headings (# to ###), paragraphs, bullet and
// numbered lists, quotes, code blocks, and inline bold, italic, code, and web links. It builds React elements, never
// HTML text, so nothing typed can add markup or script to the page. Anything else shows as plain text.

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

const isWebLink = (value: string) => /^https?:\/\/[^\s]+$/i.test(value);

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    const id = `${key}-${index}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={id}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*\s][^*]*\*$/.test(part)) return <em key={id}>{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={id} className="rounded bg-muted px-1 font-mono text-body-sm">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link && isWebLink(link[2])) {
      return (
        <a
          key={id}
          href={link[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-4"
        >
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

/** The Markdown text as elements. An empty text gives nothing. */
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  const next = () => blocks.length;

  while (index < lines.length) {
    const line = lines[index];
    const key = `b${next()}`;
    if (line.trim() === '') {
      index += 1;
    } else if (line.startsWith('```')) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre key={key} className="overflow-x-auto rounded bg-muted p-3 font-mono text-body-sm">
          {code.join('\n')}
        </pre>,
      );
    } else if (/^#{1,3} /.test(line)) {
      const level = line.indexOf(' ');
      const content = inline(line.slice(level + 1), key);
      blocks.push(
        level === 1 ? (
          <h2 key={key}>{content}</h2>
        ) : level === 2 ? (
          <h3 key={key}>{content}</h3>
        ) : (
          <h4 key={key}>{content}</h4>
        ),
      );
      index += 1;
    } else if (/^\s*[-*] /.test(line) || /^\s*\d+\. /.test(line)) {
      const ordered = /^\s*\d+\. /.test(line);
      const pattern = ordered ? /^\s*\d+\. (.*)$/ : /^\s*[-*] (.*)$/;
      const items: string[] = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push((pattern.exec(lines[index]) as RegExpExecArray)[1]);
        index += 1;
      }
      const children = items.map((item, at) => (
        <li key={`${key}-${at}`}>{inline(item, `${key}-${at}`)}</li>
      ));
      blocks.push(
        ordered ? (
          <ol key={key} className="list-decimal pl-6">
            {children}
          </ol>
        ) : (
          <ul key={key} className="list-disc pl-6">
            {children}
          </ul>
        ),
      );
    } else if (line.startsWith('> ')) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith('> ')) {
        quote.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push(
        <blockquote key={key} className="border-l-4 pl-4 text-muted-foreground">
          {inline(quote.join(' '), key)}
        </blockquote>,
      );
    } else {
      const paragraph: string[] = [];
      while (
        index < lines.length &&
        lines[index].trim() !== '' &&
        !/^(#{1,3} |```|> |\s*[-*] |\s*\d+\. )/.test(lines[index])
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      blocks.push(
        <p key={key} className="wrap-anywhere whitespace-pre-line">
          {inline(paragraph.join('\n'), key)}
        </p>,
      );
    }
  }
  return <div className="flex flex-col gap-3 text-body">{blocks}</div>;
}
