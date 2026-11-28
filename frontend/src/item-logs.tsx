import type { FormEvent, RefObject } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import { Textarea } from './components/ui/textarea';
import {
  formatKrw,
  type Item,
  logWords,
  MAX_LOG_NOTE_LENGTH,
  NO_SCORE,
  numberOrText,
} from './items';
import { formatDate, serviceToday } from './lib/format';
import { apiKey, useApiMutation, useApiQuery } from './lib/query';
import { useNotice } from './lib/use-notice';
import { LoadFailed } from './load-failed';
import { ScoreField } from './score-field';

/** One more tasting or visit of an item (#214). The item keeps its own completion as the first one. */
export type Log = {
  id: number;
  date: string;
  rating: number | null;
  note: string | null;
  costKrw: number | null;
};

type Words = { one: string; many: string };

const logsPath = (itemId: number) => `/api/items/${itemId}/logs`;

// Under the item list key, so a change that refreshes the items also refreshes the logs.
const logsKey = (itemId: number) => apiKey('/api/items', itemId, 'logs');

/** The request body of the log form. Blank optional fields clear the stored value. */
function logFields(form: FormData) {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };
  const rating = text('rating');
  const cost = text('costKrw').trim();
  // A cost that is not a plain number goes to the server as typed, so its message explains it.
  return {
    date: text('date'),
    rating: rating && rating !== NO_SCORE ? Number(rating) : null,
    costKrw: cost ? numberOrText(cost) : null,
    note: text('note') || null,
  };
}

/** The change of each rated log from the rated log before it, by log id: newest first in, oldest first compared. */
function ratingChanges(logs: readonly Log[]) {
  const changes = new Map<number, { change: number; since: string }>();
  let later: Log | null = null;
  for (const log of logs) {
    if (log.rating === null) continue;
    if (later !== null && later.rating !== null) {
      changes.set(later.id, { change: later.rating - log.rating, since: log.date });
    }
    later = log;
  }
  return changes;
}

function changeText({ change, since }: { change: number; since: string }) {
  const when = `since ${formatDate(since)}`;
  if (change === 0) return `Same as ${formatDate(since)}`;
  return change > 0 ? `Up ${change} ${when}` : `Down ${-change} ${when}`;
}

function LogForm({
  log,
  words,
  onSave,
  onCancel,
  dateRef,
}: {
  log: Log | null;
  words: Words;
  onSave: (body: ReturnType<typeof logFields>) => Promise<void>;
  onCancel?: () => void;
  dateRef?: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const ownDate = useRef<HTMLInputElement>(null);
  const date = dateRef ?? ownDate;
  // The edit form takes the place of the Edit button that opened it, so the focus moves into it. By id: a refresh in
  // the background hands over a new log object, which must not pull the focus back.
  const editedId = log?.id ?? null;
  useEffect(() => {
    if (editedId !== null) date.current?.focus();
  }, [editedId, date]);
  const { notice, error } = useNotice();
  const [pending, setPending] = useState(false);
  const today = serviceToday();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    try {
      await onSave(logFields(new FormData(form)));
    } catch (cause) {
      error(cause);
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      noValidate
      aria-label={log === null ? `Add a ${words.one}` : `Edit the ${words.one}`}
      className="flex flex-col gap-3"
      onSubmit={(event) => void submit(event)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-date`}>Date</Label>
          <Input
            ref={date}
            id={`${id}-date`}
            name="date"
            type="date"
            max={today}
            defaultValue={log?.date ?? today}
          />
        </div>
        <ScoreField id={`${id}-rating`} label="Rating" name="rating" value={log?.rating} />
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-cost`}>Cost (KRW, optional)</Label>
          <Input
            id={`${id}-cost`}
            name="costKrw"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={log?.costKrw ?? undefined}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-note`}>Note (optional)</Label>
        <Textarea
          id={`${id}-note`}
          name="note"
          rows={2}
          limit={MAX_LOG_NOTE_LENGTH}
          defaultValue={log?.note ?? undefined}
        />
      </div>
      <Notice notice={notice} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner size="sm" label="Saving" /> : null}
          {log === null ? `Add ${words.one}` : `Save ${words.one}`}
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

/** The tastings or visits of a drink or travel item, newest first, with forms to add, edit, and delete them. */
export function ItemLogs({ item }: { item: Item }) {
  const words = logWords(item.category) ?? { one: 'log', many: 'Logs' };
  const key = logsKey(item.id);
  const path = logsPath(item.id);
  const query = useApiQuery<{ logs: Log[] }>(key, path);
  const { notice, status, error } = useNotice();
  const [editing, setEditing] = useState<number | null>(null);
  // A new add form after each added log: empty fields and counters (a form reset leaves the counters).
  const [added, setAdded] = useState(0);
  // Focus targets for buttons that disappear: the add form after a delete, and the Edit button of a log whose edit
  // form closes.
  const addDate = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const closeEdit = (logId: number) => {
    setEditing(null);
    requestAnimationFrame(() => {
      list.current?.querySelector<HTMLButtonElement>(`[data-log-edit="${String(logId)}"]`)?.focus();
    });
  };
  const save = useApiMutation<Log, { id: number | null; body: object }>(
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
  const logs = query.data?.logs;
  const changes = ratingChanges(logs ?? []);
  const rated = (logs ?? []).filter((log) => log.rating !== null);
  const many = words.many.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      <Notice notice={notice} className="wrap-anywhere" />
      <p className="text-body-sm text-muted-foreground">
        The item keeps its own completed date, rating, and review as the first time; each{' '}
        {words.one} here is one more.
      </p>
      {logs === undefined ? (
        query.isError ? (
          <LoadFailed
            cause={query.error}
            reload={async () => {
              await query.refetch();
            }}
          />
        ) : (
          <Spinner label={`Loading ${many}`} />
        )
      ) : logs.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">No {many} yet.</p>
      ) : (
        <>
          {rated.length >= 2 ? (
            <p className="text-body-sm">
              Rating over time, oldest first:{' '}
              {rated
                .map((log) => log.rating)
                .reverse()
                .join(' → ')}
            </p>
          ) : null}
          <ol
            ref={list}
            aria-label={`${words.many} of ${item.title}`}
            className="flex flex-col gap-3"
          >
            {logs.map((log) => {
              const change = changes.get(log.id);
              const label = `${words.one} of ${formatDate(log.date)}`;
              return (
                <li key={log.id} className="rounded-md border p-3">
                  {editing === log.id ? (
                    <LogForm
                      log={log}
                      words={words}
                      onCancel={() => closeEdit(log.id)}
                      onSave={async (body) => {
                        await save.mutateAsync({ id: log.id, body });
                        closeEdit(log.id);
                        status(`Saved the ${words.one}`);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="font-medium">{formatDate(log.date)}</span>
                        {log.rating !== null ? <span>Rating {log.rating}</span> : null}
                        {change ? (
                          <span className="text-muted-foreground">{changeText(change)}</span>
                        ) : null}
                        {log.costKrw !== null ? (
                          <span className="text-muted-foreground">
                            Cost {formatKrw(log.costKrw)}
                          </span>
                        ) : null}
                      </p>
                      {log.note ? (
                        <p className="text-body-sm wrap-anywhere whitespace-pre-line text-muted-foreground">
                          {log.note}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Edit the ${label}`}
                          data-log-edit={log.id}
                          onClick={() => setEditing(log.id)}
                        >
                          Edit
                        </Button>
                        <ConfirmDialog
                          title={`Delete this ${words.one}?`}
                          description={`This deletes the ${label}. The item itself stays.`}
                          returnFocusRef={addDate}
                          onConfirm={async () => {
                            try {
                              await remove.mutateAsync(log.id);
                              status(`Deleted the ${words.one}`);
                            } catch (cause) {
                              error(cause);
                            }
                          }}
                          trigger={
                            <Button size="sm" variant="outline" aria-label={`Delete the ${label}`}>
                              Delete
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
      <div className="flex flex-col gap-3 border-t pt-4">
        <h3 className="text-body font-medium">Add a {words.one}</h3>
        <LogForm
          key={added}
          log={null}
          words={words}
          dateRef={addDate}
          onSave={async (body) => {
            await save.mutateAsync({ id: null, body });
            setAdded((count) => count + 1);
            status(`Added the ${words.one}`);
          }}
        />
      </div>
    </div>
  );
}
