import { CalendarClock, ChevronLeft, ChevronRight, CircleCheck } from 'lucide-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { daysOf, isMonth, shiftMonth } from './calendar-month';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { Spinner } from './components/ui/spinner';
import { categories, formatDate, type Item, itemAnchor, serviceToday } from './items';
import { apiKey, useApiQuery } from './lib/query';
import { cn } from './lib/utils';
import { LoadFailed } from './load-failed';
import { useSettledError } from './settled-error';

// #213: a month of planned and completed dates. The server sends each item with a date inside the month
// once; the screen places it on its planned day, its completed day, or both.

type CalendarItem = Pick<
  Item,
  'id' | 'category' | 'subtype' | 'title' | 'status' | 'plannedDate' | 'completedDate' | 'rating'
>;
type CalendarAnswer = { month: string; items: CalendarItem[] };
type Entry = { kind: 'planned' | 'done'; item: CalendarItem };

const KINDS = {
  planned: { label: 'Planned', icon: CalendarClock },
  done: { label: 'Done', icon: CircleCheck },
} as const;

// Sunday first, as Korean calendars are laid out.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Static class names, so Tailwind sees each one: the first day of the month starts under its weekday.
const START_COLUMN = [
  'md:col-start-1',
  'md:col-start-2',
  'md:col-start-3',
  'md:col-start-4',
  'md:col-start-5',
  'md:col-start-6',
  'md:col-start-7',
];
// The grid shows this many entries a day; the rest are counted. The list on small screens shows all.
const SHOWN_IN_GRID = 3;

const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const monthTitle = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const weekdayDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** The entries of each day of the month: a planned date and a completed date each make one. */
function entriesByDay(month: string, items: CalendarItem[]) {
  const days = new Map<string, Entry[]>();
  const add = (date: string | null, entry: Entry) => {
    if (!date?.startsWith(`${month}-`)) return;
    days.set(date, [...(days.get(date) ?? []), entry]);
  };
  for (const item of items) {
    add(item.plannedDate, { kind: 'planned', item });
    add(item.completedDate, { kind: 'done', item });
  }
  return days;
}

function summary(entries: Entry[]) {
  const planned = entries.filter(({ kind }) => kind === 'planned').length;
  const done = entries.length - planned;
  return [planned > 0 && `${planned} planned`, done > 0 && `${done} done`]
    .filter(Boolean)
    .join(', ');
}

const categoryLabel = (key: string) =>
  categories.find((category) => category.key === key)?.label ?? key;

function EntryMark({ kind }: { kind: Entry['kind'] }) {
  const { label, icon: Icon } = KINDS[kind];
  // The icon's shape tells the two apart on screen; the hidden word does for a screen reader.
  return (
    <>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">{label}: </span>
    </>
  );
}

function Legend() {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-4 text-body-sm text-muted-foreground">
      {(['planned', 'done'] as const).map((kind) => {
        const { label, icon: Icon } = KINDS[kind];
        return (
          <li key={kind} className="flex items-center gap-1.5">
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </li>
        );
      })}
    </ul>
  );
}

function Day({
  date,
  entries,
  today,
  open,
}: {
  date: string;
  entries: Entry[];
  today: boolean;
  open: (date: string) => void;
}) {
  const number = Number(date.slice(8));
  const heading = (
    <span className="flex items-baseline gap-2">
      <span className="text-body-sm font-medium md:hidden">{weekdayDate.format(utc(date))}</span>
      <span
        className={cn(
          'hidden text-body-sm font-medium md:inline',
          today && 'rounded-sm bg-primary px-1 text-primary-foreground',
        )}
      >
        {number}
      </span>
      {today ? <span className="text-caption text-muted-foreground md:sr-only">Today</span> : null}
    </span>
  );
  if (entries.length === 0) {
    // Nothing to open, so not a button: the keyboard only stops on days that have items.
    return <div className="min-h-16 rounded-md border border-dashed p-1.5">{heading}</div>;
  }
  const hidden = entries.length - SHOWN_IN_GRID;
  return (
    <button
      type="button"
      onClick={() => open(date)}
      data-day={date}
      aria-label={`${formatDate(date)}${today ? ' (today)' : ''}: ${summary(entries)}`}
      className="flex min-h-16 w-full flex-col items-stretch gap-1 rounded-md border bg-card p-1.5 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 max-md:min-h-11 max-md:p-3"
    >
      {heading}
      {/* Spans, not a list: a button may only hold phrasing content. */}
      <span className="flex flex-col gap-0.5 text-caption md:[&>span:nth-child(n+4)]:hidden">
        {entries.map(({ kind, item }) => (
          <span key={`${kind}-${item.id}`} className="flex min-w-0 items-center gap-1">
            <EntryMark kind={kind} />
            <span className="truncate">{item.title}</span>
          </span>
        ))}
      </span>
      {hidden > 0 ? (
        <span className="hidden text-caption text-muted-foreground md:block">+{hidden} more</span>
      ) : null}
    </button>
  );
}

function DayDialog({
  date,
  entries,
  bucketListPath,
  close,
}: {
  date: string;
  entries: Entry[];
  bucketListPath: string;
  close: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        // The dialog has no trigger of its own (the address opens it), so closing it returns the focus
        // to the day's button by hand, also after a reload with ?day=.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLElement>(`[data-day="${date}"]`)?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{formatDate(date)}</DialogTitle>
          <DialogDescription>
            {entries.length === 0 ? 'Nothing planned or done on this day' : summary(entries)}
          </DialogDescription>
        </DialogHeader>
        {entries.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {entries.map(({ kind, item }) => {
              const { label, icon: Icon } = KINDS[kind];
              return (
                <li key={`${kind}-${item.id}`} className="flex items-start gap-2">
                  <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <Link
                      to={`${bucketListPath}/${item.category}#${itemAnchor(item.id)}`}
                      className="font-medium wrap-anywhere text-primary underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <span className="text-caption text-muted-foreground">
                      {label} · {categoryLabel(item.category)}
                      {kind === 'done' && item.rating !== null ? ` · Rating ${item.rating}/5` : ''}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MonthNav({ month, path }: { month: string; path: string }) {
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const current = serviceToday().slice(0, 7);
  return (
    <nav aria-label="Month" className="flex flex-wrap items-center gap-2">
      {previous ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`${path}/${previous}`}>
            <ChevronLeft aria-hidden="true" />
            Previous month
          </Link>
        </Button>
      ) : null}
      {/* Always there, so a keyboard user who presses it keeps the focus on it. */}
      <Button asChild variant="ghost" size="sm">
        <Link to={`${path}/${current}`} aria-current={month === current ? 'date' : undefined}>
          This month
        </Link>
      </Button>
      {next ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`${path}/${next}`}>
            Next month
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </nav>
  );
}

function Month({
  month,
  path,
  bucketListPath,
}: {
  month: string;
  path: string;
  bucketListPath: string;
}) {
  const query = useApiQuery<CalendarAnswer>(
    apiKey('/api/calendar', month),
    `/api/calendar?month=${month}`,
  );
  const loadError = useSettledError(query);
  const [params, setParams] = useSearchParams();
  const title = monthTitle.format(utc(`${month}-01`));
  const reload = async () => {
    await query.refetch();
  };

  const days = daysOf(month);
  const byDay = entriesByDay(month, query.data?.items ?? []);
  const today = serviceToday();
  const chosen = params.get('day');
  const openDay = chosen && days.includes(chosen) && query.data ? chosen : null;
  const setDay = (day: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (day) next.set('day', day);
      else next.delete('day');
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>{title}</h2>
        <MonthNav month={month} path={path} />
      </div>
      <Legend />
      {loadError ? <LoadFailed cause={loadError} reload={reload} /> : null}
      {query.data ? (
        <>
          {byDay.size === 0 ? (
            <p className="text-body-sm text-muted-foreground">
              Nothing is planned or done in {title}.
            </p>
          ) : null}
          <div
            aria-hidden="true"
            className="hidden grid-cols-7 gap-1 text-center text-caption text-muted-foreground md:grid"
          >
            {WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <ol
            aria-label={`Days of ${title}`}
            className="grid grid-cols-1 gap-2 md:grid-cols-7 md:gap-1"
          >
            {days.map((date, index) => {
              const entries = byDay.get(date) ?? [];
              return (
                <li
                  key={date}
                  className={cn(
                    // A small screen lists only the days that have items.
                    entries.length === 0 && 'max-md:hidden',
                    index === 0 && START_COLUMN[utc(date).getUTCDay()],
                  )}
                >
                  <Day date={date} entries={entries} today={date === today} open={setDay} />
                </li>
              );
            })}
          </ol>
        </>
      ) : loadError ? null : (
        <Spinner label="Loading the calendar" />
      )}
      {openDay ? (
        <DayDialog
          date={openDay}
          entries={byDay.get(openDay) ?? []}
          bucketListPath={bucketListPath}
          close={() => setDay(null)}
        />
      ) : null}
    </div>
  );
}

export function Calendar({ path, bucketListPath }: { path: string; bucketListPath: string }) {
  const { month } = useParams();
  if (!month || !isMonth(month)) {
    return <Navigate to={`${path}/${serviceToday().slice(0, 7)}`} replace />;
  }
  // No key per month: the month links stay mounted, so the one just pressed keeps the keyboard focus.
  return <Month month={month} path={path} bucketListPath={bucketListPath} />;
}
