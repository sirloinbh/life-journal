import type { FormEvent, RefObject } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import { Textarea } from './components/ui/textarea';
import { type Item, MAX_QUOTE_LENGTH, MAX_QUOTE_NOTE_LENGTH, numberOrText } from './items';
import { apiKey, useApiMutation, useApiQuery } from './lib/query';
import { useNotice } from './lib/use-notice';
import { LoadFailed } from './load-failed';

/** A quote or highlight of a reading item (#217). */
export type Quote = { id: number; text: string; page: number | null; note: string | null };

const quotesPath = (itemId: number) => `/api/items/${itemId}/quotes`;

// Under the item list key, so a change that refreshes the items also refreshes the quotes.
const quotesKey = (itemId: number) => apiKey('/api/items', itemId, 'quotes');

/** The request body of the quote form. Blank optional fields clear the stored value. */
function quoteFields(form: FormData) {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };
  const page = text('page').trim();
  // Anything that is not a plain number goes to the server as typed, so its message explains it.
  return { text: text('text'), page: page ? numberOrText(page) : null, note: text('note') || null };
}

function QuoteForm({
  quote,
  onSave,
  onCancel,
  textRef,
}: {
  quote: Quote | null;
  onSave: (body: ReturnType<typeof quoteFields>) => Promise<void>;
  onCancel?: () => void;
  textRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const id = useId();
  const ownText = useRef<HTMLTextAreaElement>(null);
  const text = textRef ?? ownText;
  // The edit form takes the place of the Edit button that opened it, so the focus moves into it. By id: a refresh in
  // the background hands over a new quote object, which must not pull the focus back.
  const editedId = quote?.id ?? null;
  useEffect(() => {
    if (editedId !== null) text.current?.focus();
  }, [editedId, text]);
  const { notice, error } = useNotice();
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    try {
      await onSave(quoteFields(new FormData(form)));
    } catch (cause) {
      error(cause);
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      noValidate
      aria-label={quote === null ? 'Add a quote' : 'Edit the quote'}
      className="flex flex-col gap-3"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-text`}>Quote</Label>
        <Textarea
          ref={text}
          id={`${id}-text`}
          name="text"
          rows={3}
          limit={MAX_QUOTE_LENGTH}
          defaultValue={quote?.text}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-page`}>Page (optional)</Label>
        <Input
          id={`${id}-page`}
          name="page"
          inputMode="numeric"
          autoComplete="off"
          className="w-32"
          defaultValue={quote?.page ?? undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-note`}>Note (optional)</Label>
        <Textarea
          id={`${id}-note`}
          name="note"
          rows={2}
          limit={MAX_QUOTE_NOTE_LENGTH}
          defaultValue={quote?.note ?? undefined}
        />
      </div>
      <Notice notice={notice} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner size="sm" label="Saving" /> : null}
          {quote === null ? 'Add quote' : 'Save quote'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** The quotes of a reading item with forms to add, edit, and delete them; shown in the item's dialog. */
export function ItemQuotes({ item }: { item: Item }) {
  const key = quotesKey(item.id);
  const path = quotesPath(item.id);
  const query = useApiQuery<{ quotes: Quote[] }>(key, path);
  const { notice, status, error } = useNotice();
  const [editing, setEditing] = useState<number | null>(null);
  // A new add form after each added quote: empty fields and counters (a form reset leaves the counters).
  const [added, setAdded] = useState(0);
  // Focus targets for buttons that disappear: the add form after a delete, and the Edit button of a quote whose
  // edit form closes.
  const addText = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const closeEdit = (quoteId: number) => {
    setEditing(null);
    requestAnimationFrame(() => {
      list.current
        ?.querySelector<HTMLButtonElement>(`[data-quote-edit="${String(quoteId)}"]`)
        ?.focus();
    });
  };
  const save = useApiMutation<Quote, { id: number | null; body: object }>(
    ({ id, body }) => ({
      path: id === null ? path : `${path}/${id}`,
      method: id === null ? 'POST' : 'PATCH',
      body,
    }),
    { invalidate: [key] },
  );
  const remove = useApiMutation<void, number>(
    (id) => ({ path: `${path}/${id}`, method: 'DELETE' }),
    { invalidate: [key] },
  );
  const quotes = query.data?.quotes;

  return (
    <div className="flex flex-col gap-4">
      <Notice notice={notice} className="wrap-anywhere" />
      {quotes === undefined ? (
        query.isError ? (
          <LoadFailed
            cause={query.error}
            reload={async () => {
              await query.refetch();
            }}
          />
        ) : (
          <Spinner label="Loading quotes" />
        )
      ) : quotes.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">No quotes yet.</p>
      ) : (
        <ol ref={list} aria-label={`Quotes of ${item.title}`} className="flex flex-col gap-3">
          {quotes.map((quote) => (
            <li key={quote.id} className="rounded-md border p-3">
              {editing === quote.id ? (
                <QuoteForm
                  quote={quote}
                  onCancel={() => closeEdit(quote.id)}
                  onSave={async (body) => {
                    await save.mutateAsync({ id: quote.id, body });
                    closeEdit(quote.id);
                    status('Saved the quote');
                  }}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <blockquote className="border-l-2 pl-3 wrap-anywhere whitespace-pre-line">
                    {quote.text}
                  </blockquote>
                  {quote.page !== null || quote.note ? (
                    <p className="text-body-sm wrap-anywhere whitespace-pre-line text-muted-foreground">
                      {[quote.page === null ? null : `p. ${quote.page}`, quote.note]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Edit quote ${quote.text.slice(0, 40)}`}
                      data-quote-edit={quote.id}
                      onClick={() => setEditing(quote.id)}
                    >
                      Edit
                    </Button>
                    <ConfirmDialog
                      title="Delete this quote?"
                      description={
                        <span className="wrap-anywhere">This deletes the quote from the book.</span>
                      }
                      returnFocusRef={addText}
                      onConfirm={async () => {
                        try {
                          await remove.mutateAsync(quote.id);
                          status('Deleted the quote');
                        } catch (cause) {
                          error(cause);
                        }
                      }}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Delete quote ${quote.text.slice(0, 40)}`}
                        >
                          Delete
                        </Button>
                      }
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-col gap-3 border-t pt-4">
        <h3 className="text-body font-medium">Add a quote</h3>
        <QuoteForm
          key={added}
          quote={null}
          textRef={addText}
          onSave={async (body) => {
            await save.mutateAsync({ id: null, body });
            setAdded((count) => count + 1);
            status('Added the quote');
          }}
        />
      </div>
    </div>
  );
}
