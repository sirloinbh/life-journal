import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router';

import { Button } from './components/ui/button';
import { Spinner } from './components/ui/spinner';
import { formatDate, itemAnchor, serviceToday } from './items';
import { apiKey, useApiQuery } from './lib/query';
import { LoadFailed } from './load-failed';
import { useSettledError } from './settled-error';
import { addDays, isDate, lastWeeks, weekDays, weekStart } from './week-dates';

// #235: the Week and 12-week views of the day log. They read the same records: the journal entries
// (GET /api/journal with from and to) and, for the week, the items completed on each day (the calendar).

type Entry = { date: string; title: string | null; body: string };
type EntryRange = { entries: Entry[] };
type DoneItem = { id: number; category: string; title: string; completedDate: string | null };

const excerpt = (body: string) => {
  const line = body.split('\n', 1)[0] ?? '';
  return line.length > 120 ? `${line.slice(0, 120)}…` : line;
};

function useEntries(from: string, to: string) {
  return useApiQuery<EntryRange>(
    apiKey('/api/journal', 'range', from, to),
    `/api/journal?from=${from}&to=${to}&limit=100`,
  );
}

/** The items completed in the week: its days can fall in two months, so the calendar is read for each. */
function useDoneItems(from: string, to: string) {
  const first = from.slice(0, 7);
  const second = to.slice(0, 7);
  const one = useApiQuery<{ items: DoneItem[] }>(
    apiKey('/api/calendar', first),
    `/api/calendar?month=${first}`,
  );
  const two = useApiQuery<{ items: DoneItem[] }>(
    apiKey('/api/calendar', second),
    `/api/calendar?month=${second}`,
    { enabled: second !== first },
  );
  const items = [...(one.data?.items ?? []), ...(second === first ? [] : (two.data?.items ?? []))];
  const ready = one.data !== undefined && (second === first || two.data !== undefined);
  return { items, ready, failed: one.error ?? (second === first ? null : two.error) };
}

function WeekNav({ start, today, path }: { start: string; today: string; path: string }) {
  const thisWeek = weekStart(today);
  return (
    <nav aria-label="Week" className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to={`${path}/${addDays(start, -7)}`}>
          <ChevronLeft aria-hidden="true" />
          Previous week
        </Link>
      </Button>
      {start < thisWeek ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`${path}/${addDays(start, 7)}`}>
            Next week
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="sm">
        <Link to={`${path}/${thisWeek}`} aria-current={start === thisWeek ? 'date' : undefined}>
          This week
        </Link>
      </Button>
    </nav>
  );
}

export function Week({
  path,
  dayPath,
  bucketListPath,
}: {
  path: string;
  dayPath: string;
  bucketListPath: string;
}) {
  const { date } = useParams();
  const today = serviceToday();
  const start = weekStart(date !== undefined && isDate(date) ? date : today);
  const days = weekDays(start);
  const last = days[6];
  const entries = useEntries(start, last);
  const done = useDoneItems(start, last);
  const entriesError = useSettledError(entries);
  // The address always names the Sunday that starts the week.
  if (date !== start) return <Navigate to={`${path}/${start}`} replace />;

  const byDay = new Map((entries.data?.entries ?? []).map((entry) => [entry.date, entry]));
  const doneByDay = new Map<string, DoneItem[]>();
  for (const item of done.items) {
    const day = item.completedDate;
    if (!day || day < start || day > last) continue;
    const known = doneByDay.get(day) ?? [];
    if (!known.some((other) => other.id === item.id)) doneByDay.set(day, [...known, item]);
  }

  return (
    <div className="flex flex-col gap-4">
      <WeekNav start={start} today={today} path={path} />
      <p className="text-body-sm text-muted-foreground">
        {formatDate(start)} to {formatDate(last)}
      </p>
      {entriesError ? (
        <LoadFailed
          cause={entriesError}
          reload={async () => {
            await entries.refetch();
          }}
        />
      ) : null}
      {entries.data && (done.ready || done.failed) ? (
        <ol aria-label="Days of the week" className="flex flex-col gap-2">
          {days.map((day) => {
            const entry = byDay.get(day);
            const items = doneByDay.get(day) ?? [];
            return (
              <li key={day} className="flex flex-col gap-1 rounded-md border px-3 py-2">
                <Link
                  to={`${dayPath}/${day}`}
                  className="text-body-sm font-medium underline-offset-4 hover:underline"
                >
                  {formatDate(day)}
                </Link>
                {entry ? (
                  <span className="text-body-sm wrap-anywhere">
                    {entry.title ?? excerpt(entry.body)}
                  </span>
                ) : (
                  <span className="text-caption text-muted-foreground">No entry</span>
                )}
                {items.length > 0 ? (
                  <ul aria-label={`Done on ${day}`} className="flex flex-col">
                    {items.map((item) => (
                      <li key={item.id} className="text-caption text-muted-foreground">
                        Done:{' '}
                        <Link
                          to={`${bucketListPath}/${item.category}#${itemAnchor(item.id)}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : entriesError ? null : (
        <Spinner label="Loading the week" />
      )}
    </div>
  );
}

export function TwelveWeeks({ path, weekPath }: { path: string; weekPath: string }) {
  const { date } = useParams();
  const today = serviceToday();
  const valid = date !== undefined && isDate(date);
  const weeks = lastWeeks(valid ? date : today, 12);
  const first = weeks[0];
  const lastStart = weeks[11];
  const entries = useEntries(first, addDays(lastStart, 6));
  const loadError = useSettledError(entries);
  if (date !== undefined && !valid) return <Navigate to={path} replace />;

  const written = new Set((entries.data?.entries ?? []).map((entry) => entry.date));
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="12 weeks" className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`${path}/${addDays(first, -1)}`}>
            <ChevronLeft aria-hidden="true" />
            Previous 12 weeks
          </Link>
        </Button>
        {lastStart < weekStart(today) ? (
          <Button asChild variant="outline" size="sm">
            <Link to={`${path}/${addDays(lastStart, 84)}`}>
              Next 12 weeks
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="sm">
          <Link to={path}>Latest</Link>
        </Button>
      </nav>
      {loadError ? (
        <LoadFailed
          cause={loadError}
          reload={async () => {
            await entries.refetch();
          }}
        />
      ) : null}
      {entries.data ? (
        <ol aria-label="Weeks" className="flex flex-col gap-2">
          {[...weeks].reverse().map((start) => {
            const count = weekDays(start).filter((day) => written.has(day)).length;
            return (
              <li key={start}>
                <Link
                  to={`${weekPath}/${start}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 hover:bg-accent"
                >
                  <span className="text-body-sm font-medium">
                    {formatDate(start)} to {formatDate(addDays(start, 6))}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {count} of 7 days written
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : loadError ? null : (
        <Spinner label="Loading the weeks" />
      )}
    </div>
  );
}
