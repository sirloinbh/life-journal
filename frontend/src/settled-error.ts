import { useState } from 'react';

/**
 * The error of the last finished load (#158). React Query clears a query's error when a retry starts, but the screen keeps
 * the message and its "Try again" button until the retry answers, so the button (and the keyboard focus on it) stays.
 */
export function useSettledError(query: { isFetching: boolean; error: unknown }): unknown {
  const [settled, setSettled] = useState<unknown>(null);
  if (!query.isFetching && query.error !== settled) setSettled(query.error);
  return query.isFetching ? settled : query.error;
}
