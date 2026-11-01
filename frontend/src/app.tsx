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
  { to: pages.overview, label: '대시보드', icon: LayoutDashboard },
  { to: pages.bucketList, label: '버킷리스트', icon: ListChecks },
  { to: pages.table, label: '표 보기', icon: Table2 },
  { to: pages.terms, label: '용어 공부', icon: BookOpen },
  { to: pages.settings, label: '설정', icon: Settings2 },
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
            : { state: 'error', message: data.error ?? '서버 상태를 확인할 수 없습니다' },
        );
      })
      .catch(() => setHealth({ state: 'error', message: '서버에 연결할 수 없습니다' }));
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
          title="아직 기능이 없습니다"
          description="기능은 GitHub 이슈 카드로 등록한 뒤 하나씩 추가합니다."
        />
      )}
    </section>
  );
}

export function App() {
  const health = useHealth();
  return (
    <BrowserRouter>
      <AppShell appName="감상문·일기장" nav={nav}>
        <Routes>
          <Route
            path={pages.overview}
            element={
              <Page
                title="대시보드"
                description="독서·영화 감상문, 일기, 연극·콘서트 등 경험을 기록하는 개인 서비스"
                health={health}
              />
            }
          />
          <Route
            path={`${pages.bucketList}/:category?`}
            element={
              <Page
                title="버킷리스트"
                description="하고 싶은 것을 분야별로 쌓고, 해낸 것은 완료로 표시합니다"
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
                title="표 보기"
                description="모든 항목을 표로 보고 검색·필터·정렬합니다"
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
                title="용어 공부"
                description="분야별 용어와 뜻을 보고, 외운 용어를 표시합니다"
                health={health}
              >
                <TermsStudy path={pages.terms} />
              </Page>
            }
          />
          <Route
            path={pages.settings}
            element={<Page title="설정" description="앱 환경과 데이터 관리" health={health} />}
          />
          <Route path="*" element={<Navigate to={pages.overview} replace />} />
        </Routes>
      </AppShell>
      <Toaster />
    </BrowserRouter>
  );
}
