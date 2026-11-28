import { ArrowLeft, Database, FileText } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { EmptyState } from './components/ui/empty-state';
import { Notice } from './components/ui/notice';
import { Skeleton } from './components/ui/skeleton';
import { Spinner } from './components/ui/spinner';
import {
  buildTree,
  documentsKey,
  type DocumentSummary,
  type Node,
  seoulDate,
} from './documents-data';
import { formatDate } from './lib/format';
import { apiKey, useApiMutation, useApiQuery } from './lib/query';
import { useNotice } from './lib/use-notice';
import { LoadFailed } from './load-failed';
import { Markdown } from './markdown';
import { useSettledError } from './settled-error';

// #241: the Documents list. Pages imported from Notion (Settings, "Import from Notion") are shown as the tree
// they have in Notion, apart from essays. A page opens at /documents/<id> and can be copied into an essay.

type DocumentPage = DocumentSummary & { body: string };
function Tree({ nodes, path }: { nodes: Node[]; path: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {nodes.map(({ doc, children }) => (
        <li key={doc.id} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {doc.kind === 'database' ? (
              <Database aria-hidden className="size-4 text-muted-foreground" />
            ) : (
              <FileText aria-hidden className="size-4 text-muted-foreground" />
            )}
            <Link to={`${path}/${doc.id}`} className="text-body underline-offset-4 hover:underline">
              {doc.title}
            </Link>
            {doc.kind === 'database' ? <Badge variant="outline">Database</Badge> : null}
            {doc.deletedAt ? <Badge variant="warning">Removed from Notion</Badge> : null}
          </div>
          {children.length > 0 ? (
            <div className="ml-2 border-l pl-4">
              <Tree nodes={children} path={path} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function DocumentList({ path, settingsPath }: { path: string; settingsPath: string }) {
  const query = useApiQuery<{ documents: DocumentSummary[] }>(documentsKey, '/api/documents');
  const loadError = useSettledError(query);
  const tree = useMemo(() => buildTree(query.data?.documents ?? []), [query.data]);

  if (loadError && !query.data) {
    return <LoadFailed cause={loadError} reload={async () => void (await query.refetch())} />;
  }
  if (!query.data) return <Skeleton className="h-24 w-full" aria-label="Loading documents" />;
  if (tree.length === 0) {
    return (
      <EmptyState
        icon={<FileText aria-hidden />}
        title="No documents yet"
        description="Pages imported from Notion appear here with the tree they have in Notion."
        action={
          <Button asChild variant="outline">
            <Link to={settingsPath}>Go to Settings to import</Link>
          </Button>
        }
      />
    );
  }
  return (
    <nav aria-label="Documents">
      <Tree nodes={tree} path={path} />
    </nav>
  );
}

export function DocumentView({ path, essaysPath }: { path: string; essaysPath: string }) {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { notice, error, clear } = useNotice();
  const query = useApiQuery<DocumentPage>(
    apiKey('/api/documents', 'one', id),
    `/api/documents/${id}`,
    {
      enabled: Number.isInteger(id) && id > 0,
    },
  );
  const loadError = useSettledError(query);
  const copy = useApiMutation<{ id: number }, void>(() => ({
    path: `/api/documents/${id}/essay`,
  }));

  const start = async () => {
    clear();
    try {
      const essay = await copy.mutateAsync();
      await navigate(`${essaysPath}/${essay.id}`);
    } catch (cause) {
      error(cause);
    }
  };

  const back = (
    <Link
      to={path}
      className="inline-flex w-fit items-center gap-1 text-body-sm underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden className="size-4" />
      All documents
    </Link>
  );
  if (loadError && !query.data) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <LoadFailed cause={loadError} reload={async () => void (await query.refetch())} />
      </div>
    );
  }
  const doc = query.data;
  if (!doc) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <Skeleton className="h-24 w-full" aria-label="Loading the document" />
      </div>
    );
  }
  return (
    <article className="flex flex-col gap-4">
      {back}
      <header className="flex flex-col gap-2">
        <h2 className="text-h2 font-semibold">{doc.title}</h2>
        <p className="text-body-sm wrap-anywhere text-muted-foreground">{doc.path}</p>
        <p className="text-body-sm text-muted-foreground">
          Edited in Notion {formatDate(seoulDate(doc.notionEditedAt))} · imported{' '}
          {formatDate(seoulDate(doc.importedAt))}
        </p>
        {doc.deletedAt ? (
          <p>
            <Badge variant="warning">
              Removed from Notion {formatDate(seoulDate(doc.deletedAt))}
            </Badge>
          </p>
        ) : null}
      </header>
      {doc.kind === 'page' ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            aria-disabled={copy.isPending || undefined}
            onClick={() => {
              if (!copy.isPending) void start();
            }}
          >
            {copy.isPending ? <Spinner size="sm" label="Copying" /> : null}
            Copy into an essay
          </Button>
          <span className="text-body-sm text-muted-foreground">
            Makes a new draft essay; this page and its re-imports are not changed by it.
          </span>
        </div>
      ) : null}
      <Notice notice={notice} />
      {doc.kind === 'database' ? (
        <p className="text-muted-foreground">
          This is a Notion database; its pages are listed under it.
        </p>
      ) : doc.body.trim() ? (
        <Markdown text={doc.body} />
      ) : (
        <p className="text-muted-foreground">This page has no text.</p>
      )}
    </article>
  );
}
