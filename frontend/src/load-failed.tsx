import { useState } from 'react';

import { Button } from './components/ui/button';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import { errorText } from './lib/use-notice';

export function LoadFailed({ cause, reload }: { cause: unknown; reload: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const retry = async () => {
    setPending(true);
    await reload();
    setPending(false);
  };
  return (
    <div className="flex flex-col items-start gap-3">
      <Notice notice={{ kind: 'error', text: errorText(cause) }} />
      <Button variant="outline" disabled={pending} onClick={() => void retry()}>
        {pending ? <Spinner size="sm" label="다시 불러오는 중" /> : null}
        다시 시도
      </Button>
    </div>
  );
}
