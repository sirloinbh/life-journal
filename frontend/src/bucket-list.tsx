import type { FormEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router';

import { CategoryTabs } from './category-tabs';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { Spinner } from './components/ui/spinner';
import {
  categories,
  type Category,
  type Item,
  itemFields,
  itemSummary,
  MAX_REVIEW_LENGTH,
  MAX_REVIEW_LINES,
  measureReview,
  NO_SCORE,
  ratingFields,
  ratingSummary,
  reviewPreview,
  reviewProblem,
  SCORES,
  serviceToday,
} from './items';
import { RequestError, requestJson } from './lib/api';
import { useNotice } from './lib/use-notice';
import { LoadFailed } from './load-failed';

type SaveItem = (id: number | null, fields: object, done: string) => Promise<void>;

function useItems() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const latest = useRef(0);
  // Only the latest request may change the screen.
  const reload = useCallback(async () => {
    const request = ++latest.current;
    try {
      const data = await requestJson<{ items: Item[] }>('/api/items');
      if (request === latest.current) {
        setItems(data.items);
        setLoadError(null);
      }
    } catch (error) {
      if (request === latest.current) setLoadError(error);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  // Applies a change the server confirmed. The list stays right even if the next reload fails.
  const update = useCallback((change: (current: Item[]) => Item[]) => {
    setItems((current) => current && change(current));
  }, []);
  return { items, loadError, reload, update };
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

function FormButtons({ pending, submitLabel }: { pending: boolean; submitLabel: string }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline" disabled={pending}>
          Cancel
        </Button>
      </DialogClose>
      <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
        {pending ? <Spinner size="sm" label="Saving" /> : null}
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}

function ItemForm({
  category,
  item,
  pending,
  save,
}: {
  category: Category;
  item: Item | null;
  pending: boolean;
  save: SaveItem;
}) {
  const id = useId();
  const { notice, error } = useNotice();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = itemFields(category, form);
    try {
      if (item === null) {
        await save(null, { category: category.key, ...fields }, 'Saved');
      } else {
        const completedDate = form.get('completedDate') || null;
        const body = item.status === 'done' ? { ...fields, completedDate } : fields;
        await save(item.id, body, 'Saved');
      }
    } catch (cause) {
      error(cause);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <Field
        id={`${id}-title`}
        label="Title"
        name="title"
        defaultValue={item?.title}
        autoComplete="off"
      />
      {category.subtypes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-subtype`}>Subtype</Label>
          <Select name="subtype" defaultValue={item?.subtype ?? undefined}>
            <SelectTrigger id={`${id}-subtype`} className="w-full">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              {category.subtypes.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {category.fields.map(({ key, label, numeric }) => (
        <Field
          key={key}
          id={`${id}-${key}`}
          label={`${label} (optional)`}
          name={`details.${key}`}
          defaultValue={item?.details[key]}
          inputMode={numeric ? 'numeric' : undefined}
          autoComplete="off"
        />
      ))}
      <Field
        id={`${id}-cost`}
        label="Cost (KRW, optional)"
        name="costKrw"
        defaultValue={item?.costKrw ?? undefined}
        inputMode="numeric"
        autoComplete="off"
      />
      <Field
        id={`${id}-planned`}
        label="Planned date (optional)"
        name="plannedDate"
        type="date"
        defaultValue={item?.plannedDate ?? undefined}
      />
      <Field
        id={`${id}-link`}
        label="Link (optional)"
        name="link"
        defaultValue={item?.link ?? undefined}
        inputMode="url"
        autoComplete="off"
      />
      {item?.status === 'done' ? (
        <Field
          id={`${id}-completed`}
          label="Completed date"
          name="completedDate"
          type="date"
          defaultValue={item.completedDate ?? undefined}
        />
      ) : null}
      <Notice notice={notice} />
      <FormButtons pending={pending} submitLabel="Save" />
    </form>
  );
}

function CompleteForm({ item, pending, save }: { item: Item; pending: boolean; save: SaveItem }) {
  const id = useId();
  const { notice, error } = useNotice();
  const [today] = useState(serviceToday);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const completedDate = new FormData(event.currentTarget).get('completedDate') || null;
    try {
      await save(item.id, { status: 'done', completedDate }, `Marked ${item.title} as done`);
    } catch (cause) {
      error(cause);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <Field id={id} label="Completed date" name="completedDate" type="date" defaultValue={today} />
      <Notice notice={notice} />
      <FormButtons pending={pending} submitLabel="Mark as done" />
    </form>
  );
}

function ScoreField({
  id,
  label,
  name,
  value,
}: {
  id: string;
  label: string;
  name: string;
  value: number | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} defaultValue={value == null ? NO_SCORE : String(value)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_SCORE}>None</SelectItem>
          {SCORES.map((score) => (
            <SelectItem key={score} value={String(score)}>
              {score}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RatingForm({
  category,
  item,
  pending,
  save,
}: {
  category: Category;
  item: Item;
  pending: boolean;
  save: SaveItem;
}) {
  const id = useId();
  const { notice, error } = useNotice();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = ratingFields(category, new FormData(event.currentTarget));
    try {
      await save(item.id, fields, 'Saved the rating');
    } catch (cause) {
      error(cause);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <ScoreField id={`${id}-rating`} label="Overall rating" name="rating" value={item.rating} />
      <p className="text-body-sm text-muted-foreground">
        Sub-ratings are optional. The average is shown for reference only; you set the overall
        rating yourself.
      </p>
      {category.criteria.map(({ key, label }) => (
        <ScoreField
          key={key}
          id={`${id}-${key}`}
          label={label}
          name={`sub.${key}`}
          value={item.subRatings[key]}
        />
      ))}
      <Notice notice={notice} />
      <FormButtons pending={pending} submitLabel="Save" />
    </form>
  );
}

function ReviewForm({ item, pending, save }: { item: Item; pending: boolean; save: SaveItem }) {
  const id = useId();
  const { notice, error, clear } = useNotice();
  const [text, setText] = useState(item.review ?? '');
  const measured = measureReview(text);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = reviewProblem(measured);
    if (problem) {
      error(problem);
      return;
    }
    try {
      await save(item.id, { review: measured.review || null }, 'Saved the review');
    } catch (cause) {
      error(cause);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Review</Label>
        <textarea
          id={id}
          name="review"
          rows={MAX_REVIEW_LINES}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            clear();
          }}
          aria-describedby={`${id}-size`}
          className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-body-sm dark:bg-input/30"
        />
        <p id={`${id}-size`} className="text-caption text-muted-foreground">
          {measured.lines}/{MAX_REVIEW_LINES} lines · {measured.length}/{MAX_REVIEW_LENGTH}{' '}
          characters
        </p>
      </div>
      <Notice notice={notice} />
      <FormButtons pending={pending} submitLabel="Save" />
    </form>
  );
}

function ItemCard({
  item,
  category,
  onEdit,
  onRate,
  onReview,
  onComplete,
  onReopen,
  onDelete,
}: {
  item: Item;
  category: Category;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onRate: (event: MouseEvent<HTMLButtonElement>) => void;
  onReview: (event: MouseEvent<HTMLButtonElement>) => void;
  onComplete: (event: MouseEvent<HTMLButtonElement>) => void;
  onReopen: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const subtype = category.subtypes.find(({ value }) => value === item.subtype);
  const summary = itemSummary(item, category);
  const ratings = ratingSummary(item, category);
  const preview = item.review ? reviewPreview(item.review) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 wrap-anywhere">{item.title}</span>
          {subtype ? <Badge variant="outline">{subtype.label}</Badge> : null}
          <Badge variant={item.status === 'done' ? 'success' : 'secondary'}>
            {item.status === 'done' ? 'Done' : 'Want to do'}
          </Badge>
          {item.rating !== null ? <Badge variant="outline">Rating {item.rating}</Badge> : null}
        </CardTitle>
      </CardHeader>
      {summary.length > 0 || ratings || preview || item.link ? (
        <CardContent className="flex flex-col gap-1 text-body-sm wrap-anywhere text-muted-foreground">
          {summary.length > 0 ? <p>{summary.join(' · ')}</p> : null}
          {ratings ? <p>{ratings}</p> : null}
          {preview ? <p className="truncate">{preview}</p> : null}
          {item.link ? (
            <p>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open link for ${item.title}`}
                className="text-primary underline underline-offset-4"
              >
                Open link
              </a>
            </p>
          ) : null}
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap gap-2">
        {item.status === 'done' ? (
          <>
            <Button size="sm" variant="outline" aria-label={`Rate ${item.title}`} onClick={onRate}>
              Rate
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Review ${item.title}`}
              onClick={onReview}
            >
              Review
            </Button>
            <ConfirmDialog
              title="Undo done?"
              description="The status goes back to want to do, and the completed date, rating, and review are cleared."
              confirmLabel="Undo done"
              cancelLabel="Close"
              destructive={false}
              onConfirm={onReopen}
              trigger={
                <Button size="sm" variant="outline" aria-label={`Undo done for ${item.title}`}>
                  Undo done
                </Button>
              }
            />
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            aria-label={`Mark ${item.title} as done`}
            onClick={onComplete}
          >
            Mark as done
          </Button>
        )}
        <Button size="sm" variant="outline" aria-label={`Edit ${item.title}`} onClick={onEdit}>
          Edit
        </Button>
        <ConfirmDialog
          title="Delete this item?"
          description={<span className="wrap-anywhere">This deletes {item.title}.</span>}
          onConfirm={onDelete}
          trigger={
            <Button size="sm" variant="outline" aria-label={`Delete ${item.title}`}>
              Delete
            </Button>
          }
        />
      </CardFooter>
    </Card>
  );
}

type FormModal =
  | { kind: 'new' }
  | { kind: 'edit'; item: Item }
  | { kind: 'complete'; item: Item }
  | { kind: 'rate'; item: Item }
  | { kind: 'review'; item: Item };

const FORM_TITLES = {
  new: 'Add item',
  edit: 'Edit item',
  complete: 'Mark as done',
  rate: 'Rating',
  review: 'Review',
};

function CategoryItems({
  category,
  items,
  reload,
  update,
}: {
  category: Category;
  items: Item[];
  reload: () => Promise<void>;
  update: (change: (current: Item[]) => Item[]) => void;
}) {
  const { notice, status, error } = useNotice();
  // The last form stays in `modal` after closing, so the closing animation keeps its content.
  const [modal, setModal] = useState<FormModal>({ kind: 'new' });
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const shown = items.filter((item) => item.category === category.key);
  // A closing form is still on screen during its animation and must not submit again.
  const pending = saving || !formOpen;

  const openForm = (next: FormModal, event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setModal(next);
    setFormOpen(true);
  };

  const keepSaved = (saved: Item) => {
    update((current) =>
      current.some(({ id }) => id === saved.id)
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...current],
    );
  };

  const save: SaveItem = async (id, fields, done) => {
    setSaving(true);
    try {
      const saved = await requestJson<Item>(id === null ? '/api/items' : `/api/items/${id}`, {
        method: id === null ? 'POST' : 'PATCH',
        body: fields,
      });
      keepSaved(saved);
      await reload();
      status(done);
      setFormOpen(false);
    } catch (cause) {
      if (cause instanceof RequestError && cause.status === 404) void reload();
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  // Failures close the dialog and show on the page; the list is reloaded in case the item is gone.
  const changeFromDialog = async (change: () => Promise<unknown>, done: string) => {
    try {
      await change();
      await reload();
      status(done);
    } catch (cause) {
      error(cause);
      await reload();
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-body-sm text-muted-foreground">
          {category.description} · {shown.length} items
        </p>
        <Button ref={addButton} onClick={(event) => openForm({ kind: 'new' }, event)}>
          Add item
        </Button>
      </div>
      <Notice notice={notice} className="wrap-anywhere" />
      {shown.length === 0 ? (
        <EmptyState
          title={`No ${category.label} items`}
          description="Use the Add item button to add the first one."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((item) => (
            <li key={item.id}>
              <ItemCard
                item={item}
                category={category}
                onEdit={(event) => openForm({ kind: 'edit', item }, event)}
                onRate={(event) => openForm({ kind: 'rate', item }, event)}
                onReview={(event) => openForm({ kind: 'review', item }, event)}
                onComplete={(event) => openForm({ kind: 'complete', item }, event)}
                onReopen={() =>
                  changeFromDialog(async () => {
                    keepSaved(
                      await requestJson<Item>(`/api/items/${item.id}`, {
                        method: 'PATCH',
                        body: {
                          status: 'wishlist',
                          completedDate: null,
                          rating: null,
                          subRatings: {},
                          review: null,
                        },
                      }),
                    );
                  }, 'Undid done')
                }
                onDelete={() =>
                  changeFromDialog(async () => {
                    await requestJson<void>(`/api/items/${item.id}`, { method: 'DELETE' });
                    update((current) => current.filter(({ id }) => id !== item.id));
                  }, 'Deleted')
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && !saving) setFormOpen(false);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            // These dialogs have no trigger for Radix to return to. A marked-done item has lost its button.
            event.preventDefault();
            (opener.current?.isConnected ? opener.current : addButton.current)?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{FORM_TITLES[modal.kind]}</DialogTitle>
            <DialogDescription className="wrap-anywhere">
              {modal.kind === 'new' ? category.label : modal.item.title}
            </DialogDescription>
          </DialogHeader>
          {modal.kind === 'complete' ? (
            <CompleteForm item={modal.item} pending={pending} save={save} />
          ) : modal.kind === 'review' ? (
            <ReviewForm key={modal.item.id} item={modal.item} pending={pending} save={save} />
          ) : modal.kind === 'rate' ? (
            <RatingForm
              key={modal.item.id}
              category={category}
              item={modal.item}
              pending={pending}
              save={save}
            />
          ) : (
            <ItemForm
              key={modal.kind === 'edit' ? modal.item.id : 'new'}
              category={category}
              item={modal.kind === 'edit' ? modal.item : null}
              pending={pending}
              save={save}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BucketList({ path }: { path: string }) {
  const params = useParams();
  const { items, loadError, reload, update } = useItems();
  const category = categories.find(({ key }) => key === params.category);
  if (!category) return <Navigate to={`${path}/${categories[0].key}`} replace />;

  return (
    <div className="flex flex-col gap-4">
      <CategoryTabs path={path} tabs={categories} />
      {items === null ? (
        loadError ? (
          <LoadFailed cause={loadError} reload={reload} />
        ) : (
          <Spinner label="Loading items" />
        )
      ) : (
        <CategoryItems
          key={category.key}
          category={category}
          items={items}
          reload={reload}
          update={update}
        />
      )}
    </div>
  );
}
