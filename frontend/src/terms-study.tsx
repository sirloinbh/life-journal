import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router';

import { CategoryTabs } from './category-tabs';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Checkbox } from './components/ui/checkbox';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import { RequestError, requestJson } from './lib/api';
import { useNotice } from './lib/use-notice';
import { LoadFailed } from './load-failed';

type Term = {
  id: string;
  domain: string;
  term: string;
  original: string;
  meaning: string;
  learned: boolean;
};

type TermsAnswer = { domains: { key: string; label: string }[]; terms: Term[] };

function useTerms() {
  const [data, setData] = useState<TermsAnswer | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const latest = useRef(0);
  const reload = useCallback(async () => {
    const request = ++latest.current;
    try {
      const answer = await requestJson<TermsAnswer>('/api/terms');
      if (request === latest.current) {
        setData(answer);
        setLoadError(null);
      }
    } catch (error) {
      if (request === latest.current) setLoadError(error);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const keepLearned = useCallback((id: string, learned: boolean) => {
    // A list still on its way was read before this change, so it must not replace it.
    latest.current++;
    setData(
      (current) =>
        current && {
          ...current,
          terms: current.terms.map((term) => (term.id === id ? { ...term, learned } : term)),
        },
    );
  }, []);
  return { data, loadError, reload, keepLearned };
}

function matches(term: Term, search: string) {
  return [term.term, term.original, term.meaning].some((text) =>
    text.toLowerCase().includes(search),
  );
}

function TermCard({
  term,
  onChange,
}: {
  term: Term;
  onChange: (term: Term, learned: boolean) => void;
}) {
  const id = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2" className="flex flex-wrap items-baseline gap-2">
          <span className="min-w-0 wrap-anywhere">{term.term}</span>
          <span className="min-w-0 text-body-sm font-normal wrap-anywhere text-muted-foreground">
            {term.original}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-body-sm wrap-anywhere">{term.meaning}</CardContent>
      <CardFooter className="flex items-center gap-2">
        <Checkbox
          id={id}
          aria-label={`${term.term} 외움`}
          checked={term.learned}
          onCheckedChange={(checked) => onChange(term, checked === true)}
        />
        <Label htmlFor={id}>외움</Label>
      </CardFooter>
    </Card>
  );
}

function DomainTerms({
  label,
  terms,
  onChange,
}: {
  label: string;
  terms: Term[];
  onChange: (term: Term, learned: boolean) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const wanted = search.trim().toLowerCase();
  const shown = wanted ? terms.filter((term) => matches(term, wanted)) : terms;
  return (
    <>
      <p className="text-body-sm text-muted-foreground">
        {label} · 외운 용어 {terms.filter((term) => term.learned).length}/{terms.length}개
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>용어 검색</Label>
        <Input
          id={id}
          type="search"
          value={search}
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {shown.length === 0 ? (
        <EmptyState
          title={terms.length === 0 ? `${label} 용어가 없습니다` : '검색 결과가 없습니다'}
          description={terms.length === 0 ? '용어를 채우는 중입니다.' : '다른 말로 찾아 보세요.'}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((term) => (
            <li key={term.id}>
              <TermCard term={term} onChange={onChange} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function TermsStudy({ path }: { path: string }) {
  const params = useParams();
  const { data, loadError, reload, keepLearned } = useTerms();
  const { notice, error, clear } = useNotice();
  // A mark on its way ignores more clicks, so the answers cannot arrive out of order. The box stays
  // enabled because disabling it would drop the keyboard focus.
  const saving = useRef(new Set<string>());

  const changeLearned = async (term: Term, learned: boolean) => {
    if (saving.current.has(term.id)) return;
    saving.current.add(term.id);
    clear();
    try {
      await requestJson<void>(`/api/terms/${encodeURIComponent(term.id)}/learned`, {
        method: learned ? 'PUT' : 'DELETE',
      });
      keepLearned(term.id, learned);
    } catch (cause) {
      error(cause);
      if (cause instanceof RequestError && cause.status === 404) void reload();
    } finally {
      saving.current.delete(term.id);
    }
  };

  if (data === null) {
    return loadError ? (
      <LoadFailed cause={loadError} reload={reload} />
    ) : (
      <Spinner label="용어를 불러오는 중" />
    );
  }
  const domain = data.domains.find(({ key }) => key === params.domain);
  if (!domain) return <Navigate to={`${path}/${data.domains[0].key}`} replace />;

  return (
    <div className="flex flex-col gap-4">
      <CategoryTabs path={path} tabs={data.domains} />
      <Notice notice={notice} className="wrap-anywhere" />
      <DomainTerms
        key={domain.key}
        label={domain.label}
        terms={data.terms.filter((term) => term.domain === domain.key)}
        onChange={(term, learned) => void changeLearned(term, learned)}
      />
    </div>
  );
}
