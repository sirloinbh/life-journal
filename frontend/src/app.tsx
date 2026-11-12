import { BookOpen, LayoutDashboard, ListChecks, Settings2, Table2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { BucketList } from './bucket-list';
import { AppShell, type NavItem } from './components/layout/app-shell';
import { EmptyState } from './components/ui/empty-state';
import { Toaster } from './components/ui/sonner';
import { type Health, healthText } from './health';
import { ItemsTable } from './items-table';
import { TermsStudy } from './terms-study';

// Every page URL lives here (central docs/directory-rules.md).
const pages = {
  overview: '/',
  bucketList: '/bucket-list',
  table: '/table',
  terms: '/terms',
  settings: '/settings',
} as const;

// Main menu (LNB) items, in display order.
const nav: NavItem[] = [
  { to: pages.overview, label: 'Dashboard', icon: LayoutDashboard },
  { to: pages.bucketList, label: 'Bucket list', icon: ListChecks },
  { to: pages.table, label: 'Table view', icon: Table2 },
  { to: pages.terms, label: 'Study terms', icon: BookOpen },
  { to: pages.settings, label: 'Settings', icon: Settings2 },
];

function useHealth() {
  const [health, setHealth] = useState<Health>({ state: 'loading' });
  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        const data = (await response.json()) as { today?: string; error?: string };
        setHealth(
          response.ok && data.today
            ? { state: 'ok', today: data.today }
            : { state: 'error', message: data.error ?? 'Cannot check the server status' },
        );
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
  description: string;
  health: Health;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 id="page-title">{title}</h1>
        <p className="text-body text-muted-foreground">{description}</p>
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

export function App() {
  const health = useHealth();
  return (
    <BrowserRouter>
      <AppShell appName="Reviews & Diary" nav={nav}>
        <Routes>
          <Route
            path={pages.overview}
            element={
              <Page
                title="Dashboard"
                description="A personal service for recording experiences: book and movie reviews, a diary, plays, concerts, and more"
                health={health}
              />
            }
          />
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
              />
            }
          />
          <Route path="*" element={<Navigate to={pages.overview} replace />} />
        </Routes>
      </AppShell>
      <Toaster />
    </BrowserRouter>
  );
}
