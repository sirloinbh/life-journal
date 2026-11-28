import { useState } from 'react';

import { LoadFailed as KitLoadFailed } from './components/load-state/load-state';
import { errorText } from './lib/use-notice';

/** The kit's failed-load banner for a reload that returns a promise: shows the error and tracks the pending retry. */
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
    <KitLoadFailed
      message={errorText(cause)}
      pending={pending}
      onRetry={() => void retry().catch(() => undefined)}
    />
  );
}
