import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';

import { LoadFailed } from './load-failed';

test('Try again comes back after a reload that rejects', async () => {
  let calls = 0;
  const reload = () => {
    calls += 1;
    return Promise.reject(new Error('Unexpected'));
  };
  render(<LoadFailed cause={new Error('A server error occurred')} reload={reload} />);
  expect(screen.getByRole('alert')).toHaveTextContent('A server error occurred');
  const button = screen.getByRole('button', { name: 'Try again' });
  fireEvent.click(button);
  expect(screen.getByRole('button', { name: /Try again/ })).toBeDisabled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(calls).toBe(2);
});
