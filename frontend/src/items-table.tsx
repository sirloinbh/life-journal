import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
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
import { needsReset, typedCondition } from './filter-field';
import { fetchItemPage, type ItemPage, itemPagesKey } from './item-pages';
import { categories, formatDate, formatKrw, itemAnchor, itemCount } from './items';
import { errorText } from './lib/use-notice';

const ANY = 'any';

const COLUMNS = [
  { key: 'title', label: 'Title' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'costKrw', label: 'Cost' },
  { key: 'plannedDate', label: 'Planned date' },
  { key: 'completedDate', label: 'Completed date' },
  { key: 'rating', label: 'Rating' },
];

const STATUS_LABELS = { wishlist: 'Want to do', done: 'Done' };

type Shown = { pages: ItemPage[] | null; failure: unknown };

// The API answers pages (#144); the first page comes with the address and "Load more" appends the next one. Each address
// has its own query (#158), so a slow answer for an old address or a page asked for it never reaches the current list.
// Until the current address answers, the screen keeps the last list it showed, and a failure keeps it too.
function useFilteredItems(search: string) {
  const query = useInfiniteQuery({
    queryKey: itemPagesKey(search),
    queryFn: ({ pageParam, signal }) => fetchItemPage(search, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last: ItemPage) => last.nextOffset ?? undefined,
  });
  const [shown, setShown] = useState<Shown>({ pages: null, failure: null });
  const pages = query.data?.pages ?? shown.pages;
  // A failure stays until a request of this address answers; a failed "Load more" is not a failure of the list.
  const failure = query.isFetching
    ? shown.failure
    : query.isError && !query.isFetchNextPageError
      ? query.error
      : null;
  if (pages !== shown.pages || failure !== shown.failure) setShown({ pages, failure });
  // Loading means the address has no list yet or is being tried again. A refresh in the background (window focus,
  // a change on the bucket list) keeps the count and "Load more", so the keyboard focus on it is not lost.
  const loading =
    query.isFetching && !query.isFetchingNextPage && (query.data === undefined || failure !== null);
  return {
    items: pages?.flatMap((page) => page.items) ?? null,
    total: pages?.at(-1)?.total ?? 0,
    // The rows kept after a failed new address have no next page of that address.
    hasMore: !loading && query.data !== undefined && query.hasNextPage,
    failure,
    loading,
    loadingMore: query.isFetchingNextPage,
    moreFailure: query.isFetchNextPageError && !query.isFetchingNextPage ? query.error : null,
    loadMore: () => {
      if (!query.isFetchingNextPage) void query.fetchNextPage();
    },
    retry: () => void query.refetch(),
  };
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

/**
 * Applies on Enter or leaving the field. Typing Korean is never cut off by a request, and a date is
 * never searched half typed: a controlled date field also loses the digits typed so far.
 */
function InputFilter({
  id,
  label,
  value,
  type,
  inputMode,
  resetCount,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  type?: 'date';
  inputMode?: 'numeric';
  resetCount: number;
  onChange: (value: string) => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  // A new value from the address, such as going back, replaces what is in the field. So does
  // clearing the conditions, which also has to empty a half-typed date (its value reads as empty).
  useEffect(() => {
    const input = field.current;
    if (input && needsReset(input, value)) input.value = value;
  }, [value, resetCount]);
  // A half-typed or impossible date reads as empty, but the user did not clear the condition.
  const apply = (input: HTMLInputElement) => {
    const condition = typedCondition(input);
    if (condition !== null) onChange(condition);
  };
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={field}
        id={id}
        type={type}
        defaultValue={value}
        inputMode={inputMode}
        autoComplete="off"
        onBlur={(event) => apply(event.target)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') apply(event.currentTarget);
        }}
      />
    </div>
  );
}

export function ItemsTable({ bucketListPath }: { bucketListPath: string }) {
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const { items, total, hasMore, failure, loading, loadingMore, moreFailure, loadMore, retry } =
    useFilteredItems(search);
  const [resetCount, setResetCount] = useState(0);
  const sort = params.get('sort') ?? 'createdAt';
  const order = params.get('order') ?? 'desc';

  // Read the address itself, not this render's params: one tap can leave a field and press a
  // column header before the screen renders, and the second change must keep the first.
  const latestParams = () => new URLSearchParams(window.location.search);

  const setFilter = (name: string, value: string) => {
    const next = latestParams();
    if ((next.get(name) ?? '') === value) return;
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };

  const sortBy = (key: string) => {
    const next = latestParams();
    const ascending = next.get('sort') === key && next.get('order') === 'asc';
    next.set('sort', key);
    next.set('order', ascending ? 'desc' : 'asc');
    setParams(next, { replace: true });
  };

  const filterValue = (name: string) => params.get(name) ?? '';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InputFilter
          id="table-q"
          label="Search (title, category details)"
          value={filterValue('q')}
          resetCount={resetCount}
          onChange={(value) => setFilter('q', value)}
        />
        <ChoiceFilter
          id="table-category"
          label="Category"
          value={params.get('category') ?? ANY}
          options={categories.map(({ key, label }) => ({ value: key, label }))}
          onChange={(value) => setFilter('category', value === ANY ? '' : value)}
        />
        <ChoiceFilter
          id="table-status"
          label="Status"
          value={params.get('status') ?? ANY}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setFilter('status', value === ANY ? '' : value)}
        />
        <InputFilter
          id="table-from"
          label="Period start"
          type="date"
          value={filterValue('from')}
          resetCount={resetCount}
          onChange={(value) => setFilter('from', value)}
        />
        <InputFilter
          id="table-to"
          label="Period end"
          type="date"
          value={filterValue('to')}
          resetCount={resetCount}
          onChange={(value) => setFilter('to', value)}
        />
        <InputFilter
          id="table-cost-min"
          label="Minimum cost (KRW)"
          inputMode="numeric"
          value={filterValue('costMin')}
          resetCount={resetCount}
          onChange={(value) => setFilter('costMin', value)}
        />
        <InputFilter
          id="table-cost-max"
          label="Maximum cost (KRW)"
          inputMode="numeric"
          value={filterValue('costMax')}
          resetCount={resetCount}
          onChange={(value) => setFilter('costMax', value)}
        />
      </div>
      <p className="text-caption text-muted-foreground">
        The period matches the completed date, or the planned date if there is none. Text and dates
        apply when you press Enter or leave the field.
      </p>
      <div className="flex min-h-9 items-center justify-between gap-4">
        <p role="status" className="text-body-sm text-muted-foreground">
          {loading
            ? 'Loading…'
            : items
              ? items.length < total
                ? `${itemCount(total)} · showing ${items.length}`
                : itemCount(items.length)
              : ''}
        </p>
        {search ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setParams({}, { replace: true });
              setResetCount((count) => count + 1);
              // This button disappears now, so the focus moves to the first filter.
              document.getElementById('table-q')?.focus();
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      {failure ? (
        <div className="flex flex-wrap items-center gap-3">
          <Notice notice={{ kind: 'error', text: errorText(failure) }} />
          {/* Stays on screen while retrying, so the keyboard focus is not lost. */}
          <Button variant="outline" size="sm" aria-busy={loading || undefined} onClick={retry}>
            Try again
          </Button>
        </div>
      ) : null}
      {items === null ? (
        loading ? (
          <Spinner label="Loading items" />
        ) : null
      ) : items.length === 0 ? (
        loading || failure ? null : (
          <EmptyState
            title="No items match the filters"
            description="Change the filters or add an item from the bucket list."
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-md border" role="region" aria-label="Items table">
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
                      to={`${bucketListPath}/${item.category}#${itemAnchor(item.id)}`}
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
                    {item.costKrw === null ? '' : formatKrw(item.costKrw)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {item.plannedDate ? formatDate(item.plannedDate) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {item.completedDate ? formatDate(item.completedDate) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{item.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items && items.length > 0 && (hasMore || moreFailure) ? (
        <div className="flex flex-wrap items-center gap-3">
          {moreFailure ? <Notice notice={{ kind: 'error', text: errorText(moreFailure) }} /> : null}
          {/* Stays on screen while loading, so the keyboard focus is not lost. */}
          <Button
            variant="outline"
            aria-busy={loadingMore || undefined}
            onClick={loadMore}
            disabled={!hasMore}
          >
            {loadingMore ? <Spinner size="sm" label="Loading more items" /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
