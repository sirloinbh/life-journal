import assert from 'node:assert/strict';

/** An RFC 4180 reader for the test: quoted fields, "" for a quote, CRLF row ends. Unquoted empty → null. */
export function parseCsv(text: string) {
  assert.ok(text.startsWith(String.fromCharCode(0xfeff)), 'the file starts with a UTF-8 BOM');
  const rows: (string | null)[][] = [];
  let row: (string | null)[] = [];
  let index = 1;
  while (index < text.length) {
    let value: string | null;
    if (text[index] === '"') {
      value = '';
      index++;
      for (;;) {
        const quote = text.indexOf('"', index);
        assert.ok(quote >= 0, 'a quoted field is closed');
        value += text.slice(index, quote);
        index = quote + 1;
        if (text[index] === '"') {
          value += '"';
          index++;
        } else break;
      }
    } else {
      const end = text.slice(index).search(/,|\r\n/);
      const raw = text.slice(index, index + end);
      value = raw === '' ? null : raw;
      index += end;
    }
    row.push(value);
    if (text[index] === ',') index++;
    else {
      assert.equal(text.slice(index, index + 2), '\r\n', 'a row ends with CRLF');
      index += 2;
      rows.push(row);
      row = [];
    }
  }
  return rows;
}
