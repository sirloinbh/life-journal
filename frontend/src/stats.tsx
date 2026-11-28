import { ChevronLeft, ChevronRight, CircleCheckBig, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router';

import { Button } from './components/ui/button';
import { Spinner } from './components/ui/spinner';
import { StatCard } from './components/ui/stat-card';
import { categories, formatKrw, itemAnchor } from './items';
import { formatDate, serviceToday } from './lib/format';
import { apiKey, useApiQuery } from './lib/query';
import { LoadFailed } from './load-failed';
import { useSettledError } from './settled-error';

// #212: one year of completed items. The server applies the counting rules recorded on #212: only done
// items by completed date, spending as the sum of their costs, unrated items left out of averages.

type CategoryStats = {
  category: string;
  completed: number;
  rated: number;
  averageRating: number | null;
  spendingKrw: number;
};
type TopItem = {
  id: number;
  category: string;
  title: string;
  rating: number;
  completedDate: string;
};
type YearStats = {
  year: string;
  completed: number;
  spendingKrw: number;
  months: { month: string; total: number; categories: Record<string, number> }[];
  categories: CategoryStats[];
  topRated: TopItem[];
};

const isYear = (value: string) => /^\d{4}$/.test(value) && value !== '0000';
const shiftYear = (year: string, step: number) => {
  const shifted = String(Number(year) + step).padStart(4, '0');
  return isYear(shifted) ? shifted : null;
};

const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const monthLabel = (month: string) => monthName.format(new Date(`${month}-01T00:00:00Z`));
const categoryLabel = (key: string) =>
  categories.find((category) => category.key === key)?.label ?? key;
const average = (value: number | null) => (value === null ? 'No ratings' : `${value}/5`);

const cell = 'px-3 py-2 whitespace-nowrap';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `stats-${title.toLowerCase().replaceAll(' ', '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}

function YearNav({ year, path }: { year: string; path: string }) {
  const previous = shiftYear(year, -1);
  const next = shiftYear(year, 1);
  const current = serviceToday().slice(0, 4);
  // The links stay mounted while the year changes, so the one pressed keeps the keyboard focus.
  return (
    <nav aria-label="Year" className="flex flex-wrap items-center gap-2">
      {previous ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`${path}/${previous}`}>
            <ChevronLeft aria-hidden="true" />
            Previous year
          </Link>
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="sm">
        <Link to={`${path}/${current}`} aria-current={year === current ? 'date' : undefined}>
          This year
        </Link>
      </Button>
      {next ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`${path}/${next}`}>
            Next year
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </nav>
  );
}

/** Completed items per month as bars, each with its number written next to it. */
function MonthBars({ months }: { months: YearStats['months'] }) {
  const most = Math.max(1, ...months.map(({ total }) => total));
  return (
    <ol aria-label="Completed items per month" className="flex max-w-2xl flex-col gap-1.5">
      {months.map(({ month, total }) => (
        <li key={month} className="grid grid-cols-[2.5rem_1fr_3rem] items-center gap-2">
          <span className="text-body-sm text-muted-foreground">{monthLabel(month)}</span>
          <span aria-hidden="true" className="h-3">
            {total > 0 ? (
              <span
                className="block h-full rounded-r-[4px] bg-primary"
                style={{ width: `${(total / most) * 100}%` }}
              />
            ) : null}
          </span>
          <span className="text-right text-body-sm tabular-nums">
            {total}
            <span className="sr-only"> {total === 1 ? 'item' : 'items'}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The table behind the bars, split by category. */
function MonthTable({ stats }: { stats: YearStats }) {
  return (
    <div
      className="overflow-x-auto rounded-md border"
      role="region"
      aria-label="Completed per month and category"
    >
      <table className="w-full min-w-[36rem] text-left text-body-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th scope="col" className={cell}>
              Month
            </th>
            {stats.categories.map(({ category }) => (
              <th key={category} scope="col" className={`${cell} text-right`}>
                {categoryLabel(category)}
              </th>
            ))}
            <th scope="col" className={`${cell} text-right`}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.months.map(({ month, total, categories: counts }) => (
            <tr key={month} className="border-b last:border-b-0">
              <th scope="row" className={`${cell} font-normal`}>
                {monthLabel(month)}
              </th>
              {stats.categories.map(({ category }) => (
                <td key={category} className={`${cell} text-right tabular-nums`}>
                  {counts[category] ?? 0}
                </td>
              ))}
              <td className={`${cell} text-right font-medium tabular-nums`}>{total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tighter cells, and names and headings that may wrap, so the table fits a phone without scrolling.
function CategoryTable({ rows }: { rows: CategoryStats[] }) {
  return (
    <div
      className="overflow-x-auto rounded-md border"
      role="region"
      aria-label="Completed, average rating, and spending by category"
    >
      <table className="w-full text-left text-body-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th scope="col" className="px-2 py-2">
              Category
            </th>
            <th scope="col" className="px-2 py-2 text-right">
              Completed
            </th>
            <th scope="col" className="px-2 py-2 text-right">
              Average rating
            </th>
            <th scope="col" className="px-2 py-2 text-right">
              Spending
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category} className="border-b last:border-b-0">
              <th scope="row" className="px-2 py-2 font-normal">
                {categoryLabel(row.category)}
              </th>
              <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                {row.completed}
              </td>
              <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                {average(row.averageRating)}
              </td>
              <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                {formatKrw(row.spendingKrw)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopRated({ items, bucketListPath }: { items: TopItem[]; bucketListPath: string }) {
  if (items.length === 0) {
    return <p className="text-body-sm text-muted-foreground">No rated items this year.</p>;
  }
  return (
    <ol aria-label="Top rated" className="flex list-decimal flex-col gap-2 pl-6">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={`${bucketListPath}/${item.category}#${itemAnchor(item.id)}`}
            className="font-medium wrap-anywhere text-primary underline-offset-4 hover:underline"
          >
            {item.title}
          </Link>
          <span className="block text-caption text-muted-foreground">
            {categoryLabel(item.category)} · Rating {item.rating}/5 ·{' '}
            {formatDate(item.completedDate)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Year({
  year,
  path,
  bucketListPath,
}: {
  year: string;
  path: string;
  bucketListPath: string;
}) {
  const query = useApiQuery<YearStats>(apiKey('/api/stats', year), `/api/stats?year=${year}`);
  const loadError = useSettledError(query);
  const reload = async () => {
    await query.refetch();
  };
  const stats = query.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>{Number(year)}</h2>
        <YearNav year={year} path={path} />
      </div>
      {loadError ? <LoadFailed cause={loadError} reload={reload} /> : null}
      {stats ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Completed"
              value={String(stats.completed)}
              unit={stats.completed === 1 ? 'item' : 'items'}
              icon={<CircleCheckBig aria-hidden="true" className="size-4" />}
              foot={`Done in ${Number(year)}`}
            />
            <StatCard
              label="Spending"
              value={formatKrw(stats.spendingKrw)}
              unit=""
              icon={<Wallet aria-hidden="true" className="size-4" />}
              foot="Total cost of the items done"
            />
          </div>
          {stats.completed === 0 ? (
            <p className="text-body-sm text-muted-foreground">
              Nothing was completed in {Number(year)}.
            </p>
          ) : (
            <>
              <Section title="Completed per month">
                <MonthBars months={stats.months} />
                <MonthTable stats={stats} />
              </Section>
              <Section title="By category">
                <CategoryTable rows={stats.categories} />
              </Section>
              <Section title="Top rated">
                <TopRated items={stats.topRated} bucketListPath={bucketListPath} />
              </Section>
            </>
          )}
        </>
      ) : loadError ? null : (
        <Spinner label="Loading the statistics" />
      )}
    </div>
  );
}

export function Stats({ path, bucketListPath }: { path: string; bucketListPath: string }) {
  const { year } = useParams();
  if (!year || !isYear(year)) {
    return <Navigate to={`${path}/${serviceToday().slice(0, 4)}`} replace />;
  }
  // No key per year: the year links stay mounted, so the one just pressed keeps the keyboard focus.
  return <Year year={year} path={path} bucketListPath={bucketListPath} />;
}
