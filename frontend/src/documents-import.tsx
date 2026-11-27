import { useQueryClient } from '@tanstack/react-query';
import { CloudDownload } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import { documentsKey } from './documents-data';
import { apiKey, useApiMutation, useApiQuery } from './lib/query';
import { useNotice } from './lib/use-notice';

// #241: Settings, "Import from Notion". The server runs the import in the background; this card starts it and
// shows its progress and result, polling every two seconds while it runs.

type Status = {
  configured: boolean;
  state: 'idle' | 'running' | 'done' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  seen: number;
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  skipped?: number;
  current: string | null;
  error: string | null;
};

const POLL_MS = 2000;
const statusKey = apiKey('/api/notion/import');

const pages = (count: number) => (count === 1 ? '1 page' : `${count} pages`);

export function NotionImport({ documentsPath }: { documentsPath: string }) {
  const client = useQueryClient();
  const { notice, error, clear } = useNotice();
  const query = useApiQuery<Status>(statusKey, '/api/notion/import', { staleTime: 0 });
  const status = query.data;
  const running = status?.state === 'running';
  const start = useApiMutation<Status, void>(() => ({ path: '/api/notion/import' }), {
    invalidate: [statusKey],
  });

  // Poll while a run is going; when it ends, the Documents list is out of date.
  const { refetch } = query;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, refetch]);
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) void client.invalidateQueries({ queryKey: documentsKey });
    wasRunning.current = running;
  }, [running, client]);

  const run = async () => {
    clear();
    try {
      await start.mutateAsync();
    } catch (cause) {
      error(cause);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2">Import from Notion</CardTitle>
        <CardDescription>
          Reads the pages shared with the Notion integration and every page under them into{' '}
          <Link to={documentsPath} className="underline underline-offset-4">
            Documents
          </Link>
          . A new import updates only the pages that changed in Notion, and never touches your
          essays.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status && !status.configured ? (
          <p className="text-body-sm text-muted-foreground">
            The Notion token is not set on the server (NOTION_TOKEN), so the import is off.
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            variant="default"
            aria-disabled={running || start.isPending || !status?.configured || undefined}
            onClick={() => {
              if (!running && !start.isPending && status?.configured) void run();
            }}
          >
            {running ? <Spinner size="sm" label="Importing" /> : <CloudDownload aria-hidden />}
            {running ? 'Importing…' : 'Import from Notion'}
          </Button>
        </div>
        {running ? (
          <p role="status" className="text-body-sm wrap-anywhere text-muted-foreground">
            {pages(status.seen)} read so far{status.current ? `; now ${status.current}` : ''}
          </p>
        ) : null}
        {status?.state === 'done' ? (
          <p role="status" className="text-body-sm">
            Imported {pages(status.seen)}: {status.created} new, {status.updated} updated,{' '}
            {status.unchanged} unchanged, {status.deleted} removed from Notion
            {status.skipped
              ? `, ${pages(status.skipped)} skipped because Notion no longer shows them`
              : ''}
            .
          </p>
        ) : null}
        {status?.state === 'failed' ? (
          <p role="alert" className="text-body-sm wrap-anywhere text-destructive">
            The import stopped after {pages(status.seen)}: {status.error}
          </p>
        ) : null}
        <Notice notice={notice} className="wrap-anywhere" />
      </CardContent>
    </Card>
  );
}
