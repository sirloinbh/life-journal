import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';

import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import { Textarea } from './components/ui/textarea';
import { categories, itemAnchor } from './items';
import { RequestError, requestJson } from './lib/api';
import { formatDate, serviceToday } from './lib/format';
import { apiKey, useApiMutation, useApiQuery } from './lib/query';
import { useNotice } from './lib/use-notice';
import { LoadFailed } from './load-failed';
import { useSettledError } from './settled-error';

// #210: one journal entry per day. The server applies the entry rules recorded on #210 (option B): an
// optional title up to 200 characters, plain text with line breaks up to 10,000 characters, no dates
// after today. #211: the items completed that day can be linked to the entry (owner decision on #211,
// option A).

type Entry = {
  date: string;
  title: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};
type EntryPage = { entries: Entry[]; nextOffset: number | null; total: number };
type DayItem = {
  id: number;
  category: string;
  subtype: string | null;
  title: string;
  completedDate: string;
  rating: number | null;
};
type DayItems = { linked: DayItem[]; suggestions: DayItem[] };

const MAX_LENGTH = 10_000;
const MAX_TITLE_LENGTH = 200;
const PAGE_SIZE = 20;

// Every key starts with /api/journal: the entry of a date, its items, and the pages of the list.
const entryKey = (date: string) => apiKey('/api/journal', 'entry', date);
const itemsKey = (date: string) => apiKey('/api/journal', 'items', date);
const listKey = apiKey('/api/journal', 'pages');

const isRealDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const categoryLabel = (key: string) =>
  categories.find((category) => category.key === key)?.label ?? key;

const shiftDay = (date: string, step: number) => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + step);
  const shifted = day.toISOString().slice(0, 10);
  return isRealDate(shifted) ? shifted : null;
};

/** The first line of an entry, cut to a short preview. */
const excerpt = (body: string) => {
  const line = body.split('\n', 1)[0] ?? '';
  return line.length > 120 ? `${line.slice(0, 120)}…` : line;
};

/** The entry of a date, or null when that day has none (the server answers 404). */
function useEntry(date: string) {
  return useQuery<Entry | null, RequestError>({
    queryKey: entryKey(date),
    queryFn: async ({ signal }) => {
      try {
        return await requestJson<Entry>(`/api/journal/${date}`, { signal });
      } catch (cause) {
        if (cause instanceof RequestError && cause.status === 404) return null;
        throw cause;
      }
    },
  });
}

function DayNav({ date, today, path }: { date: string; today: string; path: string }) {
  const navigate = useNavigate();
  const id = useId();
  const previous = shiftDay(date, -1);
  const next = date < today ? shiftDay(date, 1) : null;
  return (
    <nav aria-label="Day" className="flex flex-wrap items-end gap-2">
      {previous ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`${path}/${previous}`}>
            <ChevronLeft aria-hidden="true" />
            Previous day
          </Link>
        </Button>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-caption text-muted-foreground">
          Go to date
        </Label>
        <Input
          id={id}
          type="date"
          className="w-auto"
          value={date}
          max={today}
          onChange={(event) => {
            const value = event.target.value;
            if (isRealDate(value) && value <= today) void navigate(`${path}/${value}`);
          }}
        />
      </div>
      {next ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`${path}/${next}`}>
            Next day
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="sm">
        <Link to={`${path}/${today}`} aria-current={date === today ? 'date' : undefined}>
          Today
        </Link>
      </Button>
    </nav>
  );
}

function Editor({ date, entry }: { date: string; entry: Entry | null }) {
  const client = useQueryClient();
  const id = useId();
  const titleId = useId();
  // After a delete the Delete button is gone, so the dialog returns the focus to the text field.
  const field = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(entry?.title ?? '');
  const [text, setText] = useState(entry?.body ?? '');
  const { notice, status, error, clear } = useNotice();
  const keep = async (saved: Entry | null) => {
    client.setQueryData(entryKey(date), saved);
    // Deleting the entry also removes its links, so the day's items are read again.
    await Promise.all([
      client.invalidateQueries({ queryKey: listKey }),
      client.invalidateQueries({ queryKey: itemsKey(date) }),
    ]);
  };
  // A blank title is sent as null: the entry then has none.
  const save = useApiMutation<Entry, { title: string; body: string }>((input) => ({
    path: `/api/journal/${date}`,
    method: 'PUT',
    body: { title: input.title.trim() || null, body: input.body },
  }));
  const remove = useApiMutation<void, void>(() => ({
    path: `/api/journal/${date}`,
    method: 'DELETE',
  }));
  const changed = text.trim() !== (entry?.body ?? '') || title.trim() !== (entry?.title ?? '');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (save.isPending) return;
    clear();
    try {
      const result = await save.mutateAsync({ title, body: text });
      setTitle(result.title ?? '');
      setText(result.body);
      await keep(result);
      status('Saved');
    } catch (cause) {
      error(cause);
    }
  };

  const deleteEntry = async () => {
    clear();
    try {
      await remove.mutateAsync();
      setTitle('');
      setText('');
      await keep(null);
      status('Deleted');
    } catch (cause) {
      if (cause instanceof RequestError && cause.status === 404) {
        setTitle('');
        setText('');
        await keep(null);
        status('Deleted');
        return;
      }
      error(cause);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={titleId}>Title (optional)</Label>
        <Input
          id={titleId}
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <Label htmlFor={id}>Entry for {formatDate(date)}</Label>
      <Textarea
        id={id}
        ref={field}
        rows={10}
        limit={MAX_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-48"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={save.isPending} aria-busy={save.isPending || undefined}>
          {save.isPending ? <Spinner size="sm" label="Saving" /> : null}
          Save
        </Button>
        {entry ? (
          <ConfirmDialog
            title="Delete this entry?"
            description={`This deletes the entry for ${formatDate(date)}.`}
            onConfirm={deleteEntry}
            returnFocusRef={field}
            trigger={
              <Button type="button" variant="outline">
                Delete
              </Button>
            }
          />
        ) : null}
        {changed ? (
          <span className="text-caption text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>
      <Notice notice={notice} />
    </form>
  );
}

function DayItemRow({
  item,
  bucketListPath,
  action,
}: {
  item: DayItem;
  bucketListPath: string;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <Link
          to={`${bucketListPath}/${item.category}#${itemAnchor(item.id)}`}
          className="text-body-sm font-medium wrap-anywhere underline-offset-4 hover:underline"
        >
          {item.title}
        </Link>
        <span className="text-caption text-muted-foreground">
          {categoryLabel(item.category)}
          {item.rating === null ? '' : ` · Rating ${item.rating}/5`}
        </span>
      </div>
      {action}
    </li>
  );
}

/** The items linked to the day's entry and the items completed that day that can still be linked. */
function DoneThatDay({
  date,
  hasEntry,
  bucketListPath,
}: {
  date: string;
  hasEntry: boolean;
  bucketListPath: string;
}) {
  const query = useApiQuery<DayItems>(itemsKey(date), `/api/journal/${date}/items`);
  const loadError = useSettledError(query);
  const reload = async () => {
    await query.refetch();
  };
  const { notice, status, error, clear } = useNotice();
  const section = useRef<HTMLElement>(null);
  // The button that replaces the one just pressed (Link becomes Unlink and back), focused once it is on screen.
  const [focusNext, setFocusNext] = useState<string | null>(null);
  const invalidate = [itemsKey(date)];
  const link = useApiMutation<DayItem, number>(
    (id) => ({ path: `/api/journal/${date}/items/${id}`, method: 'PUT' }),
    { invalidate },
  );
  const unlink = useApiMutation<void, number>(
    (id) => ({ path: `/api/journal/${date}/items/${id}`, method: 'DELETE' }),
    { invalidate },
  );
  const busy = link.isPending || unlink.isPending;

  useEffect(() => {
    if (!focusNext) return;
    // A disabled button cannot take the focus, so wait until the write has finished.
    const target = section.current?.querySelector<HTMLButtonElement>(`[data-focus="${focusNext}"]`);
    if (!target || target.disabled) return;
    target.focus();
    setFocusNext(null);
  }, [focusNext, query.data, busy]);

  const change = async (item: DayItem, linking: boolean) => {
    if (busy) return;
    clear();
    try {
      await (linking ? link : unlink).mutateAsync(item.id);
      status(linking ? `Linked ${item.title}` : `Unlinked ${item.title}`);
      setFocusNext(`${linking ? 'unlink' : 'link'}-${item.id}`);
    } catch (cause) {
      error(cause);
      // The day may have changed elsewhere (the item moved, the entry was deleted), so read it again.
      await query.refetch();
    }
  };

  const data = query.data;
  return (
    <section ref={section} aria-labelledby="done-that-day" className="flex flex-col gap-3">
      <h2 id="done-that-day">Done that day</h2>
      {loadError ? <LoadFailed cause={loadError} reload={reload} /> : null}
      {data ? (
        data.linked.length === 0 && data.suggestions.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">
            No bucket-list items were completed on this day.
          </p>
        ) : (
          <>
            {data.linked.length > 0 ? (
              <ul aria-label="Linked items" className="flex flex-col gap-2">
                {data.linked.map((item) => (
                  <DayItemRow
                    key={item.id}
                    item={item}
                    bucketListPath={bucketListPath}
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-focus={`unlink-${item.id}`}
                        aria-label={`Unlink ${item.title}`}
                        disabled={busy}
                        onClick={() => void change(item, false)}
                      >
                        Unlink
                      </Button>
                    }
                  />
                ))}
              </ul>
            ) : null}
            {data.suggestions.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-body-sm text-muted-foreground">
                  {hasEntry
                    ? 'Completed on this day and not linked yet:'
                    : 'Completed on this day. Save the entry first to link them:'}
                </p>
                <ul aria-label="Items to link" className="flex flex-col gap-2">
                  {data.suggestions.map((item) => (
                    <DayItemRow
                      key={item.id}
                      item={item}
                      bucketListPath={bucketListPath}
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-focus={`link-${item.id}`}
                          aria-label={`Link ${item.title}`}
                          disabled={busy || !hasEntry}
                          onClick={() => void change(item, true)}
                        >
                          Link
                        </Button>
                      }
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )
      ) : loadError ? null : (
        <Spinner label="Loading the items of the day" />
      )}
      <Notice notice={notice} />
    </section>
  );
}

function PastEntries({ date, path }: { date: string; path: string }) {
  const query = useInfiniteQuery<EntryPage, RequestError>({
    queryKey: listKey,
    queryFn: ({ pageParam, signal }) =>
      requestJson<EntryPage>(`/api/journal?limit=${PAGE_SIZE}&offset=${String(pageParam)}`, {
        signal,
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
  const loadError = useSettledError(query);
  const reload = async () => {
    await query.refetch();
  };
  const entries = query.data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <section aria-labelledby="past-entries" className="flex flex-col gap-3">
      <h2 id="past-entries">Past entries</h2>
      {loadError ? <LoadFailed cause={loadError} reload={reload} /> : null}
      {query.data ? (
        entries.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <ol aria-label="Past entries" className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li key={entry.date}>
                <Link
                  to={`${path}/${entry.date}`}
                  aria-current={entry.date === date ? 'page' : undefined}
                  className="flex flex-col rounded-md border px-3 py-2 hover:bg-accent aria-[current=page]:border-primary"
                >
                  <span className="text-body-sm font-medium">{formatDate(entry.date)}</span>
                  {entry.title ? (
                    <span className="text-body-sm wrap-anywhere">{entry.title}</span>
                  ) : null}
                  <span className="text-caption wrap-anywhere text-muted-foreground">
                    {excerpt(entry.body)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )
      ) : loadError ? null : (
        <Spinner label="Loading past entries" />
      )}
      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? <Spinner size="sm" label="Loading" /> : null}
          Load more
        </Button>
      ) : null}
    </section>
  );
}

function Day({
  date,
  today,
  path,
  bucketListPath,
}: {
  date: string;
  today: string;
  path: string;
  bucketListPath: string;
}) {
  const query = useEntry(date);
  const loadError = useSettledError(query);
  const reload = async () => {
    await query.refetch();
  };
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <DayNav date={date} today={today} path={path} />
        {loadError ? <LoadFailed cause={loadError} reload={reload} /> : null}
        {query.data !== undefined ? (
          // A new editor for each date, so one day's unsaved text never shows on another.
          <Editor key={date} date={date} entry={query.data} />
        ) : loadError ? null : (
          <Spinner label="Loading the entry" />
        )}
      </div>
      {query.data !== undefined ? (
        <DoneThatDay date={date} hasEntry={query.data !== null} bucketListPath={bucketListPath} />
      ) : null}
      <PastEntries date={date} path={path} />
    </div>
  );
}

export function Journal({ path, bucketListPath }: { path: string; bucketListPath: string }) {
  const { date } = useParams();
  const today = serviceToday();
  // A missing, unreal, or future date goes to today: an entry cannot be written ahead.
  if (!date || !isRealDate(date) || date > today) {
    return <Navigate to={`${path}/${today}`} replace />;
  }
  return <Day date={date} today={today} path={path} bucketListPath={bucketListPath} />;
}
