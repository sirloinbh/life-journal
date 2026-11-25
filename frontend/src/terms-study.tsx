import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router';

import { CategoryTabs } from './category-tabs';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Checkbox } from './components/ui/checkbox';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SegmentedControl, type SegmentOption } from './components/ui/segmented-control';
import { Spinner } from './components/ui/spinner';
import { RequestError } from './lib/api';
import { apiKey, useApiMutation, useApiQuery } from './lib/query';
import { errorText, useNotice } from './lib/use-notice';
import { LoadFailed } from './load-failed';
import { useSettledError } from './settled-error';
import { TermsQuiz } from './terms-study-quiz';

type Term = {
  id: string;
  domain: string;
  term: string;
  // Sent only when the original-language name differs from `term`.
  original?: string;
  meaning: string;
  learned: boolean;
};

type Mode = 'list' | 'quiz';

const MODES = [
  { value: 'list', label: 'List' },
  { value: 'quiz', label: 'Quiz' },
] as const satisfies readonly SegmentOption<Mode>[];

type TermsAnswer = { domains: { key: string; label: string }[]; terms: Term[] };

const termsKey = apiKey('/api/terms');

function useTerms() {
  const client = useQueryClient();
  const query = useApiQuery<TermsAnswer>(termsKey, '/api/terms');
  const loadError = useSettledError(query);
  // A new reload cancels one still on its way, so only the latest answer reaches the screen.
  const { refetch } = query;
  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const keepLearned = useCallback(
    (id: string, learned: boolean) => {
      client.setQueryData<TermsAnswer>(
        termsKey,
        (current) =>
          current && {
            ...current,
            terms: current.terms.map((term) => (term.id === id ? { ...term, learned } : term)),
          },
      );
      // A list still on its way may have been read before this change. Ask again, which drops that
      // answer, because a refresh after a 404 still has to happen.
      if (client.isFetching({ queryKey: termsKey }) > 0)
        void client.invalidateQueries({ queryKey: termsKey });
    },
    [client],
  );
  return { data: query.data ?? null, loadError, reload, keepLearned };
}

function matches(term: Term, search: string) {
  return [term.term, term.original, term.meaning].some((text) =>
    text?.toLowerCase().includes(search),
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
          {term.original && term.original !== term.term && (
            <span className="min-w-0 text-body-sm font-normal wrap-anywhere text-muted-foreground">
              {term.original}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-body-sm wrap-anywhere">{term.meaning}</CardContent>
      <CardFooter className="flex items-center gap-2">
        <Checkbox
          id={id}
          aria-label={`${term.term} learned`}
          checked={term.learned}
          onCheckedChange={(checked) => onChange(term, checked === true)}
        />
        <Label htmlFor={id}>Learned</Label>
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
        {label} · {terms.filter((term) => term.learned).length}/{terms.length} terms learned
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Search terms</Label>
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
          title={terms.length === 0 ? `No ${label} terms` : 'No results'}
          description={terms.length === 0 ? 'The terms are being added.' : 'Try different words.'}
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
  // The mode stays while moving between domain tabs; each domain starts its own quiz.
  const [mode, setMode] = useState<Mode>('list');
  // A mark on its way ignores more clicks, so the answers cannot arrive out of order. The box stays
  // enabled because disabling it would drop the keyboard focus.
  const saving = useRef(new Set<string>());
  const mark = useApiMutation<void, { id: string; learned: boolean }>(({ id, learned }) => ({
    path: `/api/terms/${encodeURIComponent(id)}/learned`,
    method: learned ? 'PUT' : 'DELETE',
  }));

  // A message about one domain's term does not belong on another domain's tab.
  useEffect(() => clear(), [params.domain, clear]);

  const changeLearned = async (term: Term, learned: boolean) => {
    if (saving.current.has(term.id)) return;
    saving.current.add(term.id);
    clear();
    try {
      await mark.mutateAsync({ id: term.id, learned });
      keepLearned(term.id, learned);
    } catch (cause) {
      // The answer may arrive on another domain's tab, so the message says which term it is about.
      error(`${term.term}: ${errorText(cause)}`);
      if (cause instanceof RequestError && cause.status === 404) void reload();
    } finally {
      saving.current.delete(term.id);
    }
  };

  if (data === null) {
    return loadError ? (
      <LoadFailed cause={loadError} reload={reload} />
    ) : (
      <Spinner label="Loading terms" />
    );
  }
  // With no domain there is no tab to go to, so the page says so instead of failing.
  const first = data.domains.at(0);
  if (!first) {
    return <EmptyState title="No terms yet" description="The study areas are being added." />;
  }
  const domain = data.domains.find(({ key }) => key === params.domain);
  if (!domain) return <Navigate to={`${path}/${first.key}`} replace />;
  const domainTerms = data.terms.filter((term) => term.domain === domain.key);

  return (
    <div className="flex flex-col gap-4">
      <CategoryTabs path={path} tabs={data.domains} />
      {/* A failed reload keeps the last terms on screen, but says so and offers a retry. */}
      {loadError ? <LoadFailed cause={loadError} reload={reload} /> : null}
      <Notice notice={notice} className="wrap-anywhere" />
      <SegmentedControl
        label="Study mode"
        options={MODES}
        value={mode}
        onValueChange={setMode}
        className="self-start"
      />
      {mode === 'quiz' ? (
        <TermsQuiz
          key={domain.key}
          label={domain.label}
          terms={domainTerms}
          onMarkLearned={(term) => void changeLearned(term, true)}
        />
      ) : (
        <DomainTerms
          key={domain.key}
          label={domain.label}
          terms={domainTerms}
          onChange={(term, learned) => void changeLearned(term, learned)}
        />
      )}
    </div>
  );
}
