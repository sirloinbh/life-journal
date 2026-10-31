import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Button } from './components/ui/button';
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
import { categories, type Item } from './items';
import { requestJson } from './lib/api';
import { errorText } from './lib/use-notice';

const ANY = 'any';

const COLUMNS = [
  { key: 'title', label: '제목' },
  { key: 'category', label: '분야' },
  { key: 'status', label: '상태' },
  { key: 'costKrw', label: '비용' },
  { key: 'plannedDate', label: '예정일' },
  { key: 'completedDate', label: '완료일' },
  { key: 'rating', label: '평점' },
];

const STATUS_LABELS = { wishlist: '하고 싶음', done: '완료' };

type Result = { items: Item[] | null; failure: unknown; search: string | null };

// Only the answer for the current address reaches the screen, so a slow old answer cannot replace it.
function useFilteredItems(search: string) {
  const [result, setResult] = useState<Result>({ items: null, failure: null, search: null });
  useEffect(() => {
    let current = true;
    requestJson<{ items: Item[] }>(`/api/items${search ? `?${search}` : ''}`).then(
      ({ items }) => {
        if (current) setResult({ items, failure: null, search });
      },
      (failure: unknown) => {
        if (current) setResult((last) => ({ items: last.items, failure, search }));
      },
    );
    return () => {
      current = false;
    };
  }, [search]);
  return { ...result, loading: result.search !== search };
}

function ChoiceFilter({
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
          <SelectItem value={ANY}>전체</SelectItem>
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

/** Applies on Enter or leaving the field, so typing Korean is never cut off by a request. */
function TextFilter({
  id,
  label,
  value,
  inputMode,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  inputMode?: 'numeric';
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        // A new value from the address, such as going back, replaces what is in the field.
        key={value}
        id={id}
        defaultValue={value}
        inputMode={inputMode}
        autoComplete="off"
        onBlur={(event) => onChange(event.target.value.trim())}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onChange(event.currentTarget.value.trim());
        }}
      />
    </div>
  );
}

function DateFilter({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function ItemsTable({ bucketListPath }: { bucketListPath: string }) {
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const { items, failure, loading } = useFilteredItems(search);
  const sort = params.get('sort') ?? 'createdAt';
  const order = params.get('order') ?? 'desc';

  const setFilter = (name: string, value: string) => {
    if ((params.get(name) ?? '') === (value === ANY ? '' : value)) return;
    const next = new URLSearchParams(params);
    if (value && value !== ANY) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };

  const sortBy = (key: string) => {
    const next = new URLSearchParams(params);
    next.set('sort', key);
    next.set('order', sort === key && order === 'asc' ? 'desc' : 'asc');
    setParams(next, { replace: true });
  };

  const filterValue = (name: string) => params.get(name) ?? '';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextFilter
          id="table-q"
          label="검색(제목, 분야별 정보)"
          value={filterValue('q')}
          onChange={(value) => setFilter('q', value)}
        />
        <ChoiceFilter
          id="table-category"
          label="분야"
          value={params.get('category') ?? ANY}
          options={categories.map(({ key, label }) => ({ value: key, label }))}
          onChange={(value) => setFilter('category', value)}
        />
        <ChoiceFilter
          id="table-status"
          label="상태"
          value={params.get('status') ?? ANY}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setFilter('status', value)}
        />
        <DateFilter
          id="table-from"
          label="기간 시작(완료일, 없으면 예정일)"
          value={filterValue('from')}
          onChange={(value) => setFilter('from', value)}
        />
        <DateFilter
          id="table-to"
          label="기간 끝"
          value={filterValue('to')}
          onChange={(value) => setFilter('to', value)}
        />
        <TextFilter
          id="table-cost-min"
          label="최소 비용(원)"
          inputMode="numeric"
          value={filterValue('costMin')}
          onChange={(value) => setFilter('costMin', value)}
        />
        <TextFilter
          id="table-cost-max"
          label="최대 비용(원)"
          inputMode="numeric"
          value={filterValue('costMax')}
          onChange={(value) => setFilter('costMax', value)}
        />
      </div>
      <div className="flex min-h-9 items-center justify-between gap-4">
        <p role="status" className="text-body-sm text-muted-foreground">
          {loading ? '불러오는 중…' : items ? `${items.length}개` : ''}
        </p>
        {search ? (
          <Button variant="outline" size="sm" onClick={() => setParams({}, { replace: true })}>
            조건 지우기
          </Button>
        ) : null}
      </div>
      {failure && !loading ? <Notice notice={{ kind: 'error', text: errorText(failure) }} /> : null}
      {items === null ? (
        loading ? (
          <Spinner label="항목을 불러오는 중" />
        ) : null
      ) : items.length === 0 ? (
        <EmptyState
          title="조건에 맞는 항목이 없습니다"
          description="조건을 바꾸거나 버킷리스트에서 항목을 추가해 보세요."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border" role="region" aria-label="항목 표">
          <table className="w-full min-w-[44rem] text-left text-body-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {COLUMNS.map(({ key, label }) => (
                  <th
                    key={key}
                    scope="col"
                    className="p-0 font-medium whitespace-nowrap"
                    aria-sort={
                      sort === key ? (order === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-1 px-3 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onClick={() => sortBy(key)}
                    >
                      {label}
                      {sort === key ? <span aria-hidden>{order === 'asc' ? '↑' : '↓'}</span> : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="max-w-64 px-3 py-2 wrap-anywhere">
                    <Link
                      to={`${bucketListPath}/${item.category}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {categories.find(({ key }) => key === item.category)?.label}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{STATUS_LABELS[item.status]}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {item.costKrw === null ? '' : `${item.costKrw.toLocaleString('ko-KR')}원`}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{item.plannedDate}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{item.completedDate}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{item.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
