import type { FormEvent } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
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
import { categories, type Category, type Item, itemFields, itemSummary } from './items';
import { requestJson } from './lib/api';
import { useNotice } from './lib/use-notice';
import { cn } from './lib/utils';

type SaveItem = (id: number | null, fields: object) => Promise<void>;

function useItems() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const reload = useCallback(async () => {
    try {
      const data = await requestJson<{ items: Item[] }>('/api/items');
      setItems(data.items);
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { items, loadError, reload };
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

function ItemForm({
  category,
  item,
  save,
  onDone,
}: {
  category: Category;
  item: Item | null;
  save: SaveItem;
  onDone: () => void;
}) {
  const id = useId();
  const { notice, error } = useNotice();
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = itemFields(category, form);
    setPending(true);
    try {
      if (item === null) {
        await save(null, { category: category.key, ...fields });
      } else {
        const completedDate = form.get('completedDate');
        await save(item.id, item.status === 'done' ? { ...fields, completedDate } : fields);
      }
      onDone();
    } catch (cause) {
      error(cause);
      setPending(false);
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
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            취소
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner size="sm" label="저장하는 중" /> : null}
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}

function CompleteForm({
  item,
  today,
  save,
  onDone,
}: {
  item: Item;
  today: string | undefined;
  save: SaveItem;
  onDone: () => void;
}) {
  const id = useId();
  const { notice, error } = useNotice();
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('completedDate');
    setPending(true);
    try {
      await save(item.id, { status: 'done', completedDate: value || null });
      onDone();
    } catch (cause) {
      error(cause);
      setPending(false);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <Field id={id} label="완료일" name="completedDate" type="date" defaultValue={today} />
      <Notice notice={notice} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            취소
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner size="sm" label="저장하는 중" /> : null}
          완료로 표시
        </Button>
      </DialogFooter>
    </form>
  );
}

type Modal =
  | { kind: 'new' }
  | { kind: 'edit'; item: Item }
  | { kind: 'complete'; item: Item }
  | { kind: 'reopen'; item: Item }
  | { kind: 'delete'; item: Item };

function CategoryItems({
  category,
  items,
  today,
  reload,
}: {
  category: Category;
  items: Item[];
  today: string | undefined;
  reload: () => Promise<void>;
}) {
  const { notice, status, error } = useNotice();
  const [modal, setModal] = useState<Modal | null>(null);
  const close = () => setModal(null);
  const shown = items.filter((item) => item.category === category.key);

  const save: SaveItem = async (id, fields) => {
    await requestJson<Item>(id === null ? '/api/items' : `/api/items/${id}`, {
      method: id === null ? 'POST' : 'PATCH',
      body: fields,
    });
    await reload();
  };

  // Failures close the dialog and show on the page; the list is reloaded in case the item is gone.
  const changeFromDialog = async (change: () => Promise<void>, done: string) => {
    try {
      await change();
      status(done);
    } catch (cause) {
      error(cause);
      await reload();
    }
  };

  const formDialog =
    modal?.kind === 'new' || modal?.kind === 'edit' || modal?.kind === 'complete' ? modal : null;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-body-sm text-muted-foreground">
          {category.description} · {shown.length}개
        </p>
        <Button onClick={() => setModal({ kind: 'new' })}>항목 추가</Button>
      </div>
      <Notice notice={notice} />
      {shown.length === 0 ? (
        <EmptyState
          title={`${category.label} 항목이 없습니다`}
          description="항목 추가 버튼으로 첫 항목을 넣어 보세요."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((item) => {
            const subtype = category.subtypes.find(({ value }) => value === item.subtype);
            return (
              <li key={item.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words">{item.title}</span>
                      {subtype ? <Badge variant="outline">{subtype.label}</Badge> : null}
                      <Badge variant={item.status === 'done' ? 'success' : 'secondary'}>
                        {item.status === 'done' ? '완료' : '하고 싶음'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  {itemSummary(item, category).length > 0 ? (
                    <CardContent className="text-body-sm break-words text-muted-foreground">
                      {itemSummary(item, category).join(' · ')}
                    </CardContent>
                  ) : null}
                  <CardFooter className="flex flex-wrap gap-2">
                    {item.status === 'done' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`${item.title} 완료 취소`}
                        onClick={() => setModal({ kind: 'reopen', item })}
                      >
                        완료 취소
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`${item.title} 완료 표시`}
                        onClick={() => setModal({ kind: 'complete', item })}
                      >
                        완료 표시
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`${item.title} 수정`}
                      onClick={() => setModal({ kind: 'edit', item })}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`${item.title} 삭제`}
                      onClick={() => setModal({ kind: 'delete', item })}
                    >
                      삭제
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={formDialog !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formDialog?.kind === 'new'
                ? '항목 추가'
                : formDialog?.kind === 'complete'
                  ? '완료로 표시'
                  : '항목 수정'}
            </DialogTitle>
            <DialogDescription>
              {formDialog?.kind === 'new' ? category.label : formDialog?.item.title}
            </DialogDescription>
          </DialogHeader>
          {formDialog?.kind === 'complete' ? (
            <CompleteForm
              item={formDialog.item}
              today={today}
              save={save}
              onDone={() => {
                close();
                status(`${formDialog.item.title}을(를) 완료로 표시했습니다`);
              }}
            />
          ) : formDialog ? (
            <ItemForm
              category={category}
              item={formDialog.kind === 'edit' ? formDialog.item : null}
              save={save}
              onDone={() => {
                close();
                status('저장했습니다');
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={modal?.kind === 'delete'}
        onOpenChange={(open) => !open && close()}
        title="항목을 삭제할까요?"
        description={modal?.kind === 'delete' ? `${modal.item.title}을(를) 삭제합니다.` : undefined}
        onConfirm={() =>
          modal?.kind === 'delete'
            ? changeFromDialog(async () => {
                await requestJson<void>(`/api/items/${modal.item.id}`, { method: 'DELETE' });
                await reload();
              }, '삭제했습니다')
            : undefined
        }
      />
      <ConfirmDialog
        open={modal?.kind === 'reopen'}
        onOpenChange={(open) => !open && close()}
        title="완료를 취소할까요?"
        description="상태가 하고 싶음으로 돌아가고 완료일이 지워집니다."
        confirmLabel="완료 취소"
        cancelLabel="닫기"
        destructive={false}
        onConfirm={() =>
          modal?.kind === 'reopen'
            ? changeFromDialog(
                () => save(modal.item.id, { status: 'wishlist', completedDate: null }),
                '완료를 취소했습니다',
              )
            : undefined
        }
      />
    </>
  );
}

export function BucketList({ path, today }: { path: string; today: string | undefined }) {
  const params = useParams();
  const { items, loadError, reload } = useItems();
  const category = categories.find(({ key }) => key === params.category);
  const { notice, error } = useNotice();
  useEffect(() => {
    if (loadError) error(loadError);
  }, [loadError, error]);
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
      {loadError ? (
        <div className="flex flex-col items-start gap-3">
          <Notice notice={notice} />
          <Button variant="outline" onClick={() => void reload()}>
            다시 시도
          </Button>
        </div>
      ) : items === null ? (
        <Spinner label="항목을 불러오는 중" />
      ) : (
        <CategoryItems
          key={category.key}
          category={category}
          items={items}
          today={today}
          reload={reload}
        />
      )}
    </div>
  );
}
