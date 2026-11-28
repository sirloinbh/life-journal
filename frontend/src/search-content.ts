import type { SearchResult } from './components/search/search-match';
import { requestJson } from './lib/api';

// #277: the records of this app for the top bar search. The API answers { results } with at most 20 records
// (backend/src/search.ts); the dialog cancels a request whose query changed, so the signal goes to the request.
export async function searchContent(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const { results } = await requestJson<{ results: SearchResult[] }>(
    `/api/search?q=${encodeURIComponent(query)}`,
    { signal },
  );
  return results;
}
