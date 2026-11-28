import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { XIcon } from 'lucide-react';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Combobox } from './components/ui/combobox';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SegmentedControl } from './components/ui/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { Spinner } from './components/ui/spinner';
import { Textarea } from './components/ui/textarea';
import { addName, MAX_ITEM_NAME_LENGTH } from './items';
import { RequestError, requestJson } from './lib/api';
import { formatDate } from './lib/format';
import { apiKey, useApiMutation, useApiQuery } from './lib/query';
import { useNotice } from './lib/use-notice';
import { LoadFailed } from './load-failed';
import { Markdown } from './markdown';
import { useSettledError } from './settled-error';

// #239: essays. The list at /essays and the editor at /essays/<id>. The editor saves a draft by itself a few
// seconds after the last change, and when it is left.

type Status = 'draft' | 'done';
type Summary = {
  id: number;
  title: string;
  writtenDate: string;
  status: Status;
  tags: string[];
  wordCount: number;
};
type Essay = Omit<Summary, 'wordCount'> & { body: string };
type EssayPage = { essays: Summary[]; nextOffset: number | null; total: number };

const MAX_TITLE_LENGTH = 200;
const MAX_LENGTH = 50_000;
const PAGE_SIZE = 20;
/** Quiet time after the last change before a draft is saved. */
const AUTOSAVE_MS = 3000;
const ANY = 'any';

const essaysKey = apiKey('/api/essays');
const listKey = apiKey('/api/essays', 'pages');
const tagsKey = apiKey('/api/essays', 'tags');
const essayKey = (id: number) => apiKey('/api/essays', 'one', id);

const STATUS_LABELS: Record<Status, string> = { draft: 'Draft', done: 'Done' };

/** The words of a text, counted the way the server counts them for the list. */
const countWords = (text: string) => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

const wordsLabel = (count: number) => (count === 1 ? '1 word' : `${count} words`);

function useUsedTags() {
  return useApiQuery<{ tags: string[] }>(tagsKey, '/api/essays/tags', { staleTime: 0 });
}

function Filter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function EssayList({ path }: { path: string }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const search = params.get('q') ?? '';
  const tag = params.get('tag') ?? '';
  const status = params.get('status') ?? '';
  const [typed, setTyped] = useState(search);
  const used = useUsedTags();
  const { notice, error, clear } = useNotice();
  const query = new URLSearchParams();
  if (search) query.set('q', search);
  if (tag) query.set('tag', tag);
  if (status) query.set('status', status);
  const filter = query.toString();

  const list = useInfiniteQuery<EssayPage, RequestError>({
    queryKey: [...listKey, filter],
    queryFn: ({ pageParam, signal }) =>
      requestJson<EssayPage>(
        `/api/essays?${[filter, `limit=${PAGE_SIZE}`, `offset=${String(pageParam)}`].filter(Boolean).join('&')}`,
        { signal },
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
  const loadError = useSettledError(list);
  const essays = list.data?.pages.flatMap((page) => page.essays) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const create = useApiMutation<Essay, void>(() => ({ path: '/api/essays', body: {} }), {
    invalidate: [listKey, tagsKey],
  });

  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };
  const names = used.data?.tags ?? [];
  const tagOptions = (names.includes(tag) || !tag ? names : [...names, tag]).map((name) => ({
    value: name,
    label: name,
  }));

  const start = async () => {
    clear();
    try {
      const essay = await create.mutateAsync();
      await navigate(`${path}/${essay.id}`);
    } catch (cause) {
      error(cause);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <form
          role="search"
          className="flex min-w-48 flex-1 flex-col gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setFilter('q', typed.trim());
          }}
        >
          <Label htmlFor="essay-search">Search (title, text)</Label>
          <Input
            id="essay-search"
            type="search"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
            onBlur={() => setFilter('q', typed.trim())}
          />
        </form>
        <div className="w-44">
          <Filter
            id="essay-tag"
            label="Tag"
            value={tag || ANY}
            options={tagOptions}
            onChange={(value) => setFilter('tag', value === ANY ? '' : value)}
          />
        </div>
        <div className="w-44">
          <Filter
            id="essay-status"
            label="Status"
            value={status || ANY}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={(value) => setFilter('status', value === ANY ? '' : value)}
          />
        </div>
        <Button
          type="button"
          disabled={create.isPending}
          aria-busy={create.isPending || undefined}
          onClick={() => void start()}
        >
          {create.isPending ? <Spinner size="sm" label="Creating" /> : null}
          New essay
        </Button>
      </div>
      <Notice notice={notice} />
      {loadError ? (
        <LoadFailed
          cause={loadError}
          reload={async () => {
            await list.refetch();
          }}
        />
      ) : null}
      {list.data ? (
        essays.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">
            {filter ? 'No essays match the filters.' : 'No essays yet.'}
          </p>
        ) : (
          <>
            <p className="text-caption text-muted-foreground">
              {total === 1 ? '1 essay' : `${total} essays`}
            </p>
            <ul aria-label="Essays" className="flex flex-col gap-2">
              {essays.map((essay) => (
                <li key={essay.id}>
                  <Link
                    to={`${path}/${essay.id}`}
                    className="flex flex-col gap-1 rounded-md border px-3 py-2 hover:bg-accent"
                  >
                    <span className="text-body-sm font-medium wrap-anywhere">{essay.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                      {formatDate(essay.writtenDate)} · {wordsLabel(essay.wordCount)}
                      <Badge variant={essay.status === 'done' ? 'success' : 'outline'}>
                        {STATUS_LABELS[essay.status]}
                      </Badge>
                      {essay.tags.map((name) => (
                        <Badge key={name} variant="secondary">
                          {name}
                        </Badge>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )
      ) : loadError ? null : (
        <Spinner label="Loading the essays" />
      )}
      {list.hasNextPage ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          {list.isFetchingNextPage ? <Spinner size="sm" label="Loading" /> : null}
          Load more
        </Button>
      ) : null}
    </div>
  );
}

/** The tags of the essay: the ones already used are offered, and a new one can be typed and added. */
function TagsField({ names, onChange }: { names: string[]; onChange: (names: string[]) => void }) {
  const id = useId();
  const used = useUsedTags();
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const add = () => {
    onChange(addName(names, draft));
    setDraft('');
  };
  const offered = (used.data?.tags ?? []).filter(
    (value) => addName(names, value).length > names.length,
  );
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Tags</Label>
      {names.length > 0 ? (
        <ul aria-label="Added tags" className="flex flex-wrap gap-2">
          {names.map((value) => (
            <li key={value}>
              <Badge variant="secondary" className="gap-0.5 py-0 pr-0 text-body-sm">
                <span className="max-w-60 truncate">{value}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 pointer-coarse:size-9"
                  aria-label={`Remove tag ${value}`}
                  onClick={() => {
                    onChange(names.filter((other) => other !== value));
                    field.current?.focus();
                  }}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Combobox
            ref={field}
            id={id}
            value={draft}
            onValueChange={setDraft}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              const picking = event.currentTarget.hasAttribute('aria-activedescendant');
              if ((event.key === 'Enter' && draft.trim() !== '' && !picking) || event.key === ',') {
                event.preventDefault();
                add();
              }
            }}
            options={offered}
            listLabel="Earlier tags"
            maxLength={MAX_ITEM_NAME_LENGTH}
          />
        </div>
        <Button type="button" variant="outline" aria-label="Add tag" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

type Draft = { title: string; body: string; writtenDate: string; status: Status; tags: string[] };
const draftOf = (essay: Essay): Draft => ({
  title: essay.title,
  body: essay.body,
  writtenDate: essay.writtenDate,
  status: essay.status,
  tags: essay.tags,
});
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

function Editor({ essay, path }: { essay: Essay; path: string }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const ids = { title: useId(), date: useId(), text: useId() };
  const field = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<Draft>(() => draftOf(essay));
  const [saved, setSaved] = useState<Draft>(() => draftOf(essay));
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const { notice, error, clear } = useNotice();
  const save = useApiMutation<Essay, Draft>(
    (input) => ({
      path: `/api/essays/${essay.id}`,
      method: 'PATCH',
      body: { ...input, title: input.title.trim() },
    }),
    { invalidate: [listKey, tagsKey] },
  );
  const remove = useApiMutation<void, void>(
    () => ({ path: `/api/essays/${essay.id}`, method: 'DELETE' }),
    { invalidate: [listKey, tagsKey] },
  );
  const dirty = !same(draft, saved);
  const latest = useRef({ draft, saved, dirty });
  latest.current = { draft, saved, dirty };
  const deleted = useRef(false);

  const write = async (input: Draft) => {
    try {
      const result = await save.mutateAsync(input);
      client.setQueryData(essayKey(essay.id), result);
      // Only what was sent counts as saved: text typed while the request ran stays unsaved.
      setSaved({ ...input, title: result.title });
      setDraft((current) =>
        current.title.trim() === input.title.trim() ? { ...current, title: result.title } : current,
      );
    } catch (cause) {
      error(cause);
    }
  };

  // The autosave: a few seconds after the last change, and never while another save is running.
  useEffect(() => {
    if (!dirty || save.isPending) return undefined;
    const timer = setTimeout(() => void write(draft), AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `write` only reads this render's values and mutation
  }, [dirty, draft, save.isPending]);

  // Leaving the page keeps what was typed: the unsaved draft goes out when the editor closes.
  useEffect(
    () => () => {
      const { draft: last, dirty: unsaved } = latest.current;
      if (unsaved && !deleted.current) {
        // The cache shows the typed text at once if the essay is opened again before the answer comes.
        client.setQueryData(essayKey(essay.id), { ...essay, ...last });
        void requestJson(`/api/essays/${essay.id}`, {
          method: 'PATCH',
          body: { ...last, title: last.title.trim() },
        }).then(() => client.invalidateQueries({ queryKey: essaysKey }));
      }
    },
    [client, essay],
  );

  const change = (patch: Partial<Draft>) => {
    clear();
    setDraft((current) => ({ ...current, ...patch }));
  };

  const deleteEssay = async () => {
    clear();
    try {
      await remove.mutateAsync();
      deleted.current = true;
      await navigate(path);
    } catch (cause) {
      error(cause);
    }
  };

  const words = countWords(draft.body);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && !save.isPending) void write(draft);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.title}>Title</Label>
        <Input
          id={ids.title}
          value={draft.title}
          maxLength={MAX_TITLE_LENGTH}
          autoComplete="off"
          onChange={(event) => change({ title: event.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.date}>Written date</Label>
          <Input
            id={ids.date}
            type="date"
            className="w-auto"
            value={draft.writtenDate}
            onChange={(event) => {
              if (event.target.value) change({ writtenDate: event.target.value });
            }}
          />
        </div>
        <SegmentedControl<Status>
          label="Status"
          value={draft.status}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'done', label: 'Done' },
          ]}
          onValueChange={(value) => change({ status: value })}
        />
      </div>
      <TagsField names={draft.tags} onChange={(tags) => change({ tags })} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={ids.text}>Text (Markdown)</Label>
          <SegmentedControl<'write' | 'preview'>
            label="View"
            value={mode}
            options={[
              { value: 'write', label: 'Write' },
              { value: 'preview', label: 'Preview' },
            ]}
            onValueChange={setMode}
          />
        </div>
        {mode === 'write' ? (
          <Textarea
            id={ids.text}
            ref={field}
            rows={16}
            limit={MAX_LENGTH}
            value={draft.body}
            onChange={(event) => change({ body: event.target.value })}
            className="min-h-64"
          />
        ) : (
          <div aria-label="Preview" role="region" className="min-h-64 rounded-md border p-3">
            {draft.body.trim() ? (
              <Markdown text={draft.body} />
            ) : (
              <p className="text-body-sm text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        )}
        <p className="text-caption text-muted-foreground">{wordsLabel(words)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          disabled={!dirty || save.isPending}
          aria-busy={save.isPending || undefined}
        >
          {save.isPending ? <Spinner size="sm" label="Saving" /> : null}
          Save now
        </Button>
        <ConfirmDialog
          title="Delete this essay?"
          description={`This deletes "${draft.title.trim() || 'Untitled'}".`}
          onConfirm={deleteEssay}
          returnFocusRef={field}
          trigger={
            <Button type="button" variant="outline">
              Delete
            </Button>
          }
        />
        <Button asChild variant="ghost">
          <Link to={path}>All essays</Link>
        </Button>
        <span role="status" className="text-caption text-muted-foreground">
          {save.isPending
            ? 'Saving…'
            : dirty
              ? 'Unsaved changes, saved automatically'
              : 'All changes saved'}
        </span>
      </div>
      <Notice notice={notice} />
    </form>
  );
}

export function EssayEditor({ path }: { path: string }) {
  const { id } = useParams();
  const essayId = Number(id);
  const valid = Number.isInteger(essayId) && essayId > 0 && String(essayId) === id;
  const query = useApiQuery<Essay>(essayKey(essayId), `/api/essays/${essayId}`, {
    enabled: valid,
  });
  const loadError = useSettledError(query);
  if (!valid) return <Navigate to={path} replace />;
  if (loadError instanceof RequestError && loadError.status === 404) {
    return (
      <p className="text-body-sm text-muted-foreground">
        This essay does not exist.{' '}
        <Link to={path} className="underline underline-offset-4">
          Back to all essays
        </Link>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {loadError ? (
        <LoadFailed
          cause={loadError}
          reload={async () => {
            await query.refetch();
          }}
        />
      ) : null}
      {query.data ? (
        // A new editor for each essay, so one essay's unsaved text never shows on another.
        <Editor key={query.data.id} essay={query.data} path={path} />
      ) : loadError ? null : (
        <Spinner label="Loading the essay" />
      )}
    </div>
  );
}
