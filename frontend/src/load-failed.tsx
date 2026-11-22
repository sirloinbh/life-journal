import { useState } from 'react';

import { Button } from './components/ui/button';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import { errorText } from './lib/use-notice';

export function LoadFailed({ cause, reload }: { cause: unknown; reload: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  // The button comes back even if the reload rejects; reporting that failure is the reload's job.
  const retry = async () => {
    setPending(true);
    try {
      await reload();
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex flex-col items-start gap-3">
      <Notice notice={{ kind: 'error', text: errorText(cause) }} />
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => void retry().catch(() => undefined)}
      >
        {pending ? <Spinner size="sm" label="Reloading" /> : null}
        Try again
      </Button>
    </div>
  );
}
