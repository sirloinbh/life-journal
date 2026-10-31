import type { FormEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Navigate, NavLink, useParams } from 'react-router';

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
  NO_SCORE,
  ratingFields,
  ratingSummary,
  SCORES,
  serviceToday,
} from './items';
import { RequestError, requestJson } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';
import { cn } from './lib/utils';

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
          취소
        </Button>
      </DialogClose>
      <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
        {pending ? <Spinner size="sm" label="저장하는 중" /> : null}
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
        await save(null, { category: category.key, ...fields }, '저장했습니다');
      } else {
        const completedDate = form.get('completedDate') || null;
        const body = item.status === 'done' ? { ...fields, completedDate } : fields;
        await save(item.id, body, '저장했습니다');
      }
    } catch (cause) {
      error(cause);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <Field
        id={`${id}-title`}
        label="제목"
        name="title"
        defaultValue={item?.title}
        autoComplete="off"
      />
      {category.subtypes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-subtype`}>세부 종류</Label>
          <Select name="subtype" defaultValue={item?.subtype ?? undefined}>
            <SelectTrigger id={`${id}-subtype`} className="w-full">
              <SelectValue placeholder="선택해 주세요" />
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
          label={`${label} (선택)`}
          name={`details.${key}`}
          defaultValue={item?.details[key]}
          inputMode={numeric ? 'numeric' : undefined}
          autoComplete="off"
        />
      ))}
      <Field
        id={`${id}-cost`}
        label="비용(원, 선택)"
        name="costKrw"
        defaultValue={item?.costKrw ?? undefined}
        inputMode="numeric"
        autoComplete="off"
      />
      <Field
        id={`${id}-planned`}
        label="예정일 (선택)"
        name="plannedDate"
        type="date"
        defaultValue={item?.plannedDate ?? undefined}
      />
      {item?.status === 'done' ? (
        <Field
          id={`${id}-completed`}
          label="완료일"
          name="completedDate"
          type="date"
          defaultValue={item.completedDate ?? undefined}
        />
      ) : null}
      <Notice notice={notice} />
      <FormButtons pending={pending} submitLabel="저장" />
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
      await save(
        item.id,
        { status: 'done', completedDate },
        `${item.title}을(를) 완료로 표시했습니다`,
      );
    } catch (cause) {
      error(cause);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <Field id={id} label="완료일" name="completedDate" type="date" defaultValue={today} />
      <Notice notice={notice} />
      <FormButtons pending={pending} submitLabel="완료로 표시" />
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
          <SelectItem value={NO_SCORE}>없음</SelectItem>
          {SCORES.map((score) => (
            <SelectItem key={score} value={String(score)}>
              {score}점
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
      await save(item.id, fields, '평점을 저장했습니다');
    } catch (cause) {
      error(cause);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <ScoreField id={`${id}-rating`} label="전체 평점" name="rating" value={item.rating} />
      <p className="text-body-sm text-muted-foreground">
        세부 평점은 선택입니다. 평균은 참고로만 보여 주고, 전체 평점은 직접 매깁니다.
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
      <FormButtons pending={pending} submitLabel="저장" />
    </form>
  );
}

function ItemCard({
  item,
  category,
  onEdit,
  onRate,
  onComplete,
  onReopen,
  onDelete,
}: {
  item: Item;
  category: Category;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onRate: (event: MouseEvent<HTMLButtonElement>) => void;
  onComplete: (event: MouseEvent<HTMLButtonElement>) => void;
  onReopen: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const subtype = category.subtypes.find(({ value }) => value === item.subtype);
  const summary = itemSummary(item, category);
  const ratings = ratingSummary(item, category);
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 wrap-anywhere">{item.title}</span>
          {subtype ? <Badge variant="outline">{subtype.label}</Badge> : null}
          <Badge variant={item.status === 'done' ? 'success' : 'secondary'}>
            {item.status === 'done' ? '완료' : '하고 싶음'}
          </Badge>
          {item.rating !== null ? <Badge variant="outline">평점 {item.rating}</Badge> : null}
        </CardTitle>
      </CardHeader>
      {summary.length > 0 || ratings ? (
        <CardContent className="flex flex-col gap-1 text-body-sm wrap-anywhere text-muted-foreground">
          {summary.length > 0 ? <p>{summary.join(' · ')}</p> : null}
          {ratings ? <p>{ratings}</p> : null}
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap gap-2">
        {item.status === 'done' ? (
          <>
            <Button size="sm" variant="outline" aria-label={`${item.title} 평점`} onClick={onRate}>
              평점
            </Button>
            <ConfirmDialog
              title="완료를 취소할까요?"
              description="상태가 하고 싶음으로 돌아가고 완료일과 평점이 지워집니다."
              confirmLabel="완료 취소"
              cancelLabel="닫기"
              destructive={false}
              onConfirm={onReopen}
              trigger={
                <Button size="sm" variant="outline" aria-label={`${item.title} 완료 취소`}>
                  완료 취소
                </Button>
              }
            />
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            aria-label={`${item.title} 완료 표시`}
            onClick={onComplete}
          >
            완료 표시
          </Button>
        )}
        <Button size="sm" variant="outline" aria-label={`${item.title} 수정`} onClick={onEdit}>
          수정
        </Button>
        <ConfirmDialog
          title="항목을 삭제할까요?"
          description={<span className="wrap-anywhere">{item.title}을(를) 삭제합니다.</span>}
          onConfirm={onDelete}
          trigger={
            <Button size="sm" variant="outline" aria-label={`${item.title} 삭제`}>
              삭제
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
  | { kind: 'rate'; item: Item };

const FORM_TITLES = { new: '항목 추가', edit: '항목 수정', complete: '완료로 표시', rate: '평점' };

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
          {category.description} · {shown.length}개
        </p>
        <Button ref={addButton} onClick={(event) => openForm({ kind: 'new' }, event)}>
          항목 추가
        </Button>
      </div>
      <Notice notice={notice} className="wrap-anywhere" />
      {shown.length === 0 ? (
        <EmptyState
          title={`${category.label} 항목이 없습니다`}
          description="항목 추가 버튼으로 첫 항목을 넣어 보세요."
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
                        },
                      }),
                    );
                  }, '완료를 취소했습니다')
                }
                onDelete={() =>
                  changeFromDialog(async () => {
                    await requestJson<void>(`/api/items/${item.id}`, { method: 'DELETE' });
                    update((current) => current.filter(({ id }) => id !== item.id));
                  }, '삭제했습니다')
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

function LoadFailed({ cause, reload }: { cause: unknown; reload: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const retry = async () => {
    setPending(true);
    await reload();
    setPending(false);
  };
  return (
    <div className="flex flex-col items-start gap-3">
      <Notice notice={{ kind: 'error', text: errorText(cause) }} />
      <Button variant="outline" disabled={pending} onClick={() => void retry()}>
        {pending ? <Spinner size="sm" label="다시 불러오는 중" /> : null}
        다시 시도
      </Button>
    </div>
  );
}

export function BucketList({ path }: { path: string }) {
  const params = useParams();
  const { items, loadError, reload, update } = useItems();
  const category = categories.find(({ key }) => key === params.category);
  if (!category) return <Navigate to={`${path}/${categories[0].key}`} replace />;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="분야" className="-mx-1 overflow-x-auto border-b px-1">
        <ul className="flex w-max gap-1">
          {categories.map(({ key, label }) => (
            <li key={key}>
              <NavLink
                to={`${path}/${key}`}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-11 items-center border-b-2 px-3 text-body-sm font-medium whitespace-nowrap',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {items === null ? (
        loadError ? (
          <LoadFailed cause={loadError} reload={reload} />
        ) : (
          <Spinner label="항목을 불러오는 중" />
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
