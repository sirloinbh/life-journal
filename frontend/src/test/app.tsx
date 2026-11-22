import { render } from '@testing-library/react';

import { App } from '../app';
import { createQueryClient } from '../lib/query';

// Helpers the screen tests share (#154).

/** A fetch answer with a JSON body; `undefined` sends no body, as a 204 does. */
export const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

/**
 * Opens the whole app at `path`, the way a reload of that address would. Each call gets a fresh query cache, and a
 * failed load is not retried on its own, so a test sees each answer it fakes exactly once (#158).
 */
export function openAt(path: string) {
  window.history.replaceState(null, '', path);
  const queryClient = createQueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false } },
  });
  render(<App queryClient={queryClient} />);
}

/** A promise a test opens by hand, to hold a fake answer until then. */
export function gate() {
  let open = () => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

/** jsdom has none of these; the Select component needs them. Call it in `beforeAll`. */
export function allowSelect() {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
