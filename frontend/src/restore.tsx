import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';

import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { requestJson } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';
import {
  describeCounts,
  type ExportSummary,
  MAX_RESTORE_BYTES,
  summarizeExport,
} from './restore-file';

type Restored = {
  restored: {
    items: number;
    item_quotes: number;
    item_logs: number;
    learned_terms: number;
    audit_log: number;
  };
};

// Settings › Restore records (#209). Owner decision: a restore replaces every record (no merge), after
// a confirmation that shows the counts in the file.
export function RestoreRecords() {
  const id = useId();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const { notice, status, error, clear } = useNotice();
  const [chosen, setChosen] = useState<{ name: string; summary: ExportSummary } | null>(null);

  const choose = async (file: File | undefined) => {
    clear();
    setChosen(null);
    if (!file) return;
    try {
      if (file.size > MAX_RESTORE_BYTES) throw new Error('The file is larger than 20 MB');
      setChosen({ name: file.name, summary: summarizeExport(await file.text()) });
    } catch (cause) {
      error(errorText(cause));
    }
  };

  // The dialog closes either way; a failure shows in this card, where it stays readable.
  const restore = async () => {
    if (!chosen) return;
    try {
      const { restored } = await requestJson<Restored>('/api/restore', {
        method: 'POST',
        body: chosen.summary.body,
        timeoutMs: 120_000,
      });
      const counts = describeCounts({
        items: restored.items,
        quotes: restored.item_quotes,
        logs: restored.item_logs,
        learnedTerms: restored.learned_terms,
        history: restored.audit_log,
      });
      status(`Restored ${counts} from ${chosen.name}.`);
      setChosen(null);
      if (input.current) input.current.value = '';
      // Every list on every page now shows the restored records.
      await queryClient.invalidateQueries();
    } catch (cause) {
      error(errorText(cause));
    }
  };

  const summary = chosen?.summary;
  const contents = summary && describeCounts(summary);
  return (
    <Card>
      <CardHeader>
        <CardTitle asHeading="h2">Restore records</CardTitle>
        <CardDescription>
          Choose a JSON file downloaded above. A restore replaces every current record, learned
          term, and history entry with the ones in the file, so download a fresh export first to
          keep what you have now.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={id}>Export file (JSON)</Label>
          <Input
            id={id}
            ref={input}
            type="file"
            accept=".json,application/json"
            onChange={(event) => void choose(event.target.files?.[0])}
          />
        </div>
        {chosen && summary ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-body-sm wrap-anywhere">
              {chosen.name}, made {summary.exportedAt}, holds {contents}.
            </p>
            <ConfirmDialog
              title="Replace all records?"
              description={`Every current record and learned term is replaced by the ${contents} in ${chosen.name}. This cannot be undone.`}
              confirmLabel="Replace all records"
              onConfirm={restore}
              returnFocusRef={input}
              trigger={<Button variant="destructive">Restore from this file</Button>}
            />
          </div>
        ) : null}
        <Notice notice={notice} className="wrap-anywhere" />
      </CardContent>
    </Card>
  );
}
