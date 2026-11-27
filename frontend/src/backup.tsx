import { Download } from 'lucide-react';
import { useState } from 'react';

import { download } from './backup-download';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Notice } from './components/ui/notice';
import { errorText, useNotice } from './lib/use-notice';
import { RestoreRecords } from './restore';

type Export = { key: 'json' | 'csv'; path: string; label: string; fallbackName: string };

// The server names each file with the service date (Asia/Seoul); the fallback names apply only when
// that header is missing.
const EXPORTS: readonly Export[] = [
  {
    key: 'json',
    path: '/api/export',
    label: 'Download all records (JSON)',
    fallbackName: 'life-journal.json',
  },
  {
    key: 'csv',
    path: '/api/export/items.csv',
    label: 'Download items (CSV)',
    fallbackName: 'life-journal-items.csv',
  },
];

// Settings › Back up records (#208): download every record to keep a copy outside the Docker volume.
// Restore records (#209) follows it on the same page.
export function DataBackup() {
  const { notice, status, error } = useNotice();
  const [busy, setBusy] = useState<Export['key'] | null>(null);

  const start = async (file: Export) => {
    // A download on its way ignores more clicks; the button stays focusable (aria-disabled).
    if (busy) return;
    setBusy(file.key);
    status('Preparing the download…');
    try {
      status(`Downloaded ${await download(file.path, file.fallbackName)}`);
    } catch (cause) {
      error(errorText(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle asHeading="h2">Back up records</CardTitle>
          <CardDescription>
            The JSON file holds every record, essay, journal entry, and learned term; keep it to
            restore the records later. The CSV file holds the items for a spreadsheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {EXPORTS.map((file) => (
              <Button
                key={file.key}
                variant={file.key === 'json' ? 'default' : 'outline'}
                aria-disabled={busy !== null || undefined}
                onClick={() => void start(file)}
              >
                <Download aria-hidden />
                {file.label}
              </Button>
            ))}
          </div>
          <Notice notice={notice} className="wrap-anywhere" />
        </CardContent>
      </Card>
      <RestoreRecords />
    </>
  );
}
