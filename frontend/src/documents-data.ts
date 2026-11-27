import { apiKey } from './lib/query';

export type DocumentSummary = {
  id: number;
  notionId: string;
  parentNotionId: string | null;
  kind: 'page' | 'database';
  title: string;
  path: string;
  notionEditedAt: string;
  importedAt: string;
  deletedAt: string | null;
};
export type Node = { doc: DocumentSummary; children: Node[] };

export const documentsKey = apiKey('/api/documents');

/** The date, in the service time zone, as `YYYY-MM-DD`. */
export const seoulDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

/** The tree from the flat list: a page whose parent is not in the list (a top page) is a root. */
export function buildTree(documents: DocumentSummary[]): Node[] {
  const nodes = new Map(documents.map((doc) => [doc.notionId, { doc, children: [] as Node[] }]));
  const roots: Node[] = [];
  for (const node of nodes.values()) {
    const parent = node.doc.parentNotionId ? nodes.get(node.doc.parentNotionId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: Node[]) => {
    list.sort((a, b) => a.doc.title.localeCompare(b.doc.title));
    for (const node of list) sort(node.children);
  };
  sort(roots);
  return roots;
}
