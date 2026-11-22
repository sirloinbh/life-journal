import { render } from '@testing-library/react';

import { App } from '../app';

// Helpers the screen tests share (#154).

/** A fetch answer with a JSON body; `undefined` sends no body, as a 204 does. */
export const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

/** Opens the whole app at `path`, the way a reload of that address would. */
export function openAt(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
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
