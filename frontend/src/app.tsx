import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  FileText,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  PenLine,
  Settings2,
  Table2,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';

import { DataBackup } from './backup';
import { BucketList } from './bucket-list';
import { Calendar } from './calendar';
import { AppShell, type NavItem } from './components/layout/app-shell';
import { NavTabs } from './components/nav-tabs/nav-tabs';
import { EmptyState } from './components/ui/empty-state';
import { Toaster } from './components/ui/sonner';
import { DocumentList, DocumentView } from './documents';
import { NotionImport } from './documents-import';
import { EssayEditor, EssayList } from './essays';
import { type Health, healthText } from './health';
import { ItemsTable } from './items-table';
import { Journal } from './journal';
import { TwelveWeeks, Week } from './journal-weeks';
import { createQueryClient } from './lib/query';
import { searchContent } from './search-content';
import { AccountActions, SignInGate } from './sign-in';
import { Stats } from './stats';
import { TermsStudy } from './terms-study';

// Every page URL lives here (central docs/directory-rules.md).
const pages = {
  start: '/',
  overview: '/dashboard',
  // #280: Week and 12 weeks are views of the Dashboard; /week and /weeks redirect here.
  week: '/dashboard/week',
  weeks: '/dashboard/weeks',
  essays: '/essays',
  documents: '/documents',
  bucketList: '/bucket-list',
  table: '/table',
  calendar: '/calendar',
  journal: '/journal',
  stats: '/stats',
  terms: '/terms',
  settings: '/settings',
} as const;

// Main menu (LNB) items, in display order (central rule, #1128): the day log, the other
// pages, Dashboard (with the Week and 12 weeks views), Settings. The day log is the start page: `/` opens it, and it lives at /journal/<date>.
const nav: NavItem[] = [
  { to: pages.journal, label: 'Day log', icon: NotebookPen },
  { to: pages.essays, label: 'Essays', icon: PenLine },
  { to: pages.documents, label: 'Documents', icon: FileText },
  { to: pages.bucketList, label: 'Bucket list', icon: ListChecks },
  { to: pages.table, label: 'Table view', icon: Table2 },
  { to: pages.calendar, label: 'Calendar', icon: CalendarDays },
  { to: pages.stats, label: 'Statistics', icon: ChartColumn },
  { to: pages.terms, label: 'Study terms', icon: BookOpen },
  { to: pages.overview, label: 'Dashboard', icon: LayoutDashboard },
  { to: pages.settings, label: 'Settings', icon: Settings2 },
];

const healthFailure = (response: Response) =>
  response.ok
    ? 'Cannot check the server status'
    : `Cannot check the server status (HTTP ${response.status})`;

function useHealth() {
  const [health, setHealth] = useState<Health>({ state: 'loading' });
  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        // A proxy error page (nginx 502/504) is HTML: the server answered, so say which status.
        const data = (await response.json().catch(() => null)) as {
          today?: unknown;
          error?: unknown;
        } | null;
        if (response.ok && typeof data?.today === 'string' && data.today) {
          setHealth({ state: 'ok', today: data.today });
        } else if (!response.ok && typeof data?.error === 'string' && data.error) {
          setHealth({ state: 'error', message: data.error });
        } else {
          setHealth({ state: 'error', message: healthFailure(response) });
        }
      })
      .catch(() => setHealth({ state: 'error', message: 'Cannot reach the server' }));
  }, []);
  return health;
}

function Page({
  title,
  description,
  health,
  children,
}: {
  title: string;
  description?: string;
  health: Health;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 id="page-title">{title}</h1>
        {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
        {health.state === 'error' ? (
          <p role="alert" className="text-body-sm text-destructive">
            {healthText(health)}
          </p>
        ) : (
          <p role="status" className="text-caption text-muted-foreground">
            {healthText(health)}
          </p>
        )}
      </header>
      {children ?? (
        <EmptyState
          title="No features yet"
          description="Features are registered as GitHub issue cards and added one at a time."
        />
      )}
    </section>
  );
}

/** The Dashboard: the Week and 12 weeks views behind one choice (#280). */
function DashboardPage({ health, children }: { health: Health; children: ReactNode }) {
  return (
    <Page title="Dashboard" health={health}>
      <NavTabs
        label="Dashboard view"
        items={[
          { to: pages.week, label: 'Week' },
          { to: pages.weeks, label: '12 weeks' },
        ]}
        className="mb-4"
      />
      {children}
    </Page>
  );
}

/** An old address (/week/<date>) opens the new one with the same date. */
function MovedTo({ to }: { to: string }) {
  const { date } = useParams();
  return <Navigate to={date ? `${to}/${date}` : to} replace />;
}

/** `queryClient` is for tests, which use one without retries; the app makes its own once (#158). */
export function App({ queryClient }: { queryClient?: QueryClient }) {
  const health = useHealth();
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <SignInGate>
          <AppShell
            appName="Reviews & Diary"
            nav={nav}
            actions={<AccountActions />}
            searchContent={searchContent}
          >
            <Routes>
              <Route path={pages.start} element={<Navigate to={pages.journal} replace />} />
              <Route path={pages.overview} element={<Navigate to={pages.week} replace />} />
              <Route
                path={`${pages.bucketList}/:category?`}
                element={
                  <Page
                    title="Bucket list"
                    description="Collect what you want to do by category and mark what you finish as done"
                    health={health}
                  >
                    <BucketList path={pages.bucketList} />
                  </Page>
                }
              />
              <Route
                path={pages.table}
                element={
                  <Page
                    title="Table view"
                    description="See every item in a table and search, filter, and sort it"
                    health={health}
                  >
                    <ItemsTable bucketListPath={pages.bucketList} />
                  </Page>
                }
              />
              <Route
                path={`${pages.calendar}/:month?`}
                element={
                  <Page
                    title="Calendar"
                    description="See what is planned and what was done on each day of a month"
                    health={health}
                  >
                    <Calendar path={pages.calendar} bucketListPath={pages.bucketList} />
                  </Page>
                }
              />
              <Route
                path={`${pages.journal}/:date?`}
                element={
                  <Page
                    title="Day log"
                    description="Write one entry a day and read the days before"
                    health={health}
                  >
                    <Journal path={pages.journal} bucketListPath={pages.bucketList} />
                  </Page>
                }
              />
              <Route
                path={`${pages.week}/:date?`}
                element={
                  <DashboardPage health={health}>
                    <Week
                      path={pages.week}
                      dayPath={pages.journal}
                      bucketListPath={pages.bucketList}
                    />
                  </DashboardPage>
                }
              />
              <Route
                path={`${pages.weeks}/:date?`}
                element={
                  <DashboardPage health={health}>
                    <TwelveWeeks path={pages.weeks} weekPath={pages.week} />
                  </DashboardPage>
                }
              />
              <Route path="/week/:date?" element={<MovedTo to={pages.week} />} />
              <Route path="/weeks/:date?" element={<MovedTo to={pages.weeks} />} />
              <Route
                path={pages.essays}
                element={
                  <Page
                    title="Essays"
                    description="Write longer pieces in Markdown; drafts save themselves"
                    health={health}
                  >
                    <EssayList path={pages.essays} />
                  </Page>
                }
              />
              <Route
                path={pages.documents}
                element={
                  <Page
                    title="Documents"
                    description="Pages imported from Notion, with the tree they have in Notion"
                    health={health}
                  >
                    <DocumentList path={pages.documents} settingsPath={pages.settings} />
                  </Page>
                }
              />
              <Route
                path={`${pages.documents}/:id`}
                element={
                  <Page
                    title="Document"
                    description="Read an imported Notion page or copy it into an essay"
                    health={health}
                  >
                    <DocumentView path={pages.documents} essaysPath={pages.essays} />
                  </Page>
                }
              />
              <Route
                path={`${pages.essays}/:id`}
                element={
                  <Page
                    title="Essay"
                    description="Write and edit one essay; changes save themselves a few seconds after you stop typing"
                    health={health}
                  >
                    <EssayEditor path={pages.essays} />
                  </Page>
                }
              />
              <Route
                path={`${pages.stats}/:year?`}
                element={
                  <Page
                    title="Statistics"
                    description="See what you completed in a year: by month and category, spending, ratings, and favorites"
                    health={health}
                  >
                    <Stats path={pages.stats} bucketListPath={pages.bucketList} />
                  </Page>
                }
              />
              <Route
                path={`${pages.terms}/:domain?`}
                element={
                  <Page
                    title="Study terms"
                    description="See terms and meanings by category and mark the ones you have learned"
                    health={health}
                  >
                    <TermsStudy path={pages.terms} />
                  </Page>
                }
              />
              <Route
                path={pages.settings}
                element={
                  <Page
                    title="Settings"
                    description="App environment and data management"
                    health={health}
                  >
                    <DataBackup />
                    <NotionImport documentsPath={pages.documents} />
                  </Page>
                }
              />
              <Route path="*" element={<Navigate to={pages.start} replace />} />
            </Routes>
          </AppShell>
          <Toaster />
        </SignInGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
