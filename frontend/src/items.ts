import { CATEGORIES, MAX_REVIEW_LENGTH, MAX_REVIEW_LINES, SCORES } from '../../shared/contract';

// Category rules come from shared/contract.ts, which the server also uses. It checks every value again.
export { MAX_REVIEW_LENGTH, MAX_REVIEW_LINES, SCORES };

export type Item = {
  id: number;
  category: string;
  subtype: string | null;
  title: string;
  status: 'wishlist' | 'done';
  costKrw: number | null;
  plannedDate: string | null;
  completedDate: string | null;
  details: Record<string, string | number>;
  rating: number | null;
  subRatings: Record<string, number>;
  review: string | null;
  link: string | null;
};

export type Category = {
  key: string;
  label: string;
  description: string;
  subtypes: { value: string; label: string }[];
  fields: { key: string; label: string; numeric?: boolean }[];
  criteria: { key: string; label: string }[];
};

const krw = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KRW' });
const day = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** Won as shown on screen, e.g. `₩12,500`. */
export const formatKrw = (amount: number) => krw.format(amount);

/** A `YYYY-MM-DD` date as shown on screen, e.g. `October 22, 2026`. */
export const formatDate = (date: string) => day.format(new Date(`${date}T00:00:00Z`));

// The element id of an item on the bucket list, used as the link anchor from the items table.
export const itemAnchor = (id: number) => `item-${id}`;

export const categories: Category[] = CATEGORIES.map((rule) => ({
  key: rule.key,
  label: rule.label,
  description: rule.description,
  subtypes: [...rule.subtypes],
  fields: rule.fields.map(({ key, label, type }) => ({ key, label, numeric: type === 'year' })),
  criteria: [...rule.criteria],
}));

/** Today in the service time zone. The server rejects a completed date after its own today. */
export function serviceToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Only plain integers such as 15000 or 15,000 become numbers. Anything else, such as 15.000 or 1e3,
// goes to the server as it is, so the server's Korean message explains it.
export function numberOrText(value: string) {
  return /^-?(\d+|\d{1,3}(,\d{3})+)$/.test(value) ? Number(value.replaceAll(',', '')) : value;
}

/** The request fields of the item form. Blank optional fields clear the stored value. */
export function itemFields(category: Category, form: FormData) {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const details: Record<string, string | number> = {};
  for (const { key, numeric } of category.fields) {
    const value = text(`details.${key}`);
    if (value) details[key] = numeric ? numberOrText(value) : value;
  }
  const cost = text('costKrw');
  return {
    title: text('title'),
    subtype: text('subtype') || null,
    costKrw: cost ? numberOrText(cost) : null,
    plannedDate: text('plannedDate') || null,
    link: text('link') || null,
    details,
  };
}

export function itemSummary(item: Item, category: Category) {
  const parts = category.fields.flatMap(({ key, label }) => {
    const value = item.details[key];
    return value === undefined ? [] : [`${label} ${value}`];
  });
  if (item.costKrw !== null) parts.push(`Cost ${formatKrw(item.costKrw)}`);
  if (item.plannedDate) parts.push(`Planned ${formatDate(item.plannedDate)}`);
  if (item.completedDate) parts.push(`Completed ${formatDate(item.completedDate)}`);
  return parts;
}

/** The review as the server stores it, with its size. The server checks the same limits. */
export function measureReview(text: string) {
  const review = text.replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n').trim();
  return { review, lines: review ? review.split('\n').length : 0, length: review.length };
}

/** The first line that shows anything; zero-width characters alone would preview as a blank line. */
export function reviewPreview(review: string) {
  return (
    review.split('\n').find((line) => /[^\s\p{Cf}\u115f\u1160\u2800\u3164\uffa0]/u.test(line)) ??
    null
  );
}

export function reviewProblem({ lines, length }: { lines: number; length: number }) {
  if (lines > MAX_REVIEW_LINES) return `Review must be ${MAX_REVIEW_LINES} lines or fewer`;
  if (length > MAX_REVIEW_LENGTH) return `Review must be ${MAX_REVIEW_LENGTH} characters or fewer`;
  return null;
}

/** The form's "none" choice is NO_SCORE; only chosen scores are sent. */
export const NO_SCORE = 'none';

export function ratingFields(category: Category, form: FormData) {
  const chosen = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' && value && value !== NO_SCORE ? Number(value) : null;
  };
  const subRatings: Record<string, number> = {};
  for (const { key } of category.criteria) {
    const value = chosen(`sub.${key}`);
    if (value !== null) subRatings[key] = value;
  }
  return { rating: chosen('rating'), subRatings };
}

/** The sub-rating line. Its average is for reference only; the overall rating is set by hand. */
export function ratingSummary(item: Item, category: Category) {
  const scored = category.criteria.flatMap(({ key, label }) => {
    const value = item.subRatings[key];
    return value === undefined ? [] : [{ label, value }];
  });
  if (scored.length === 0) return null;
  const average = scored.reduce((sum, { value }) => sum + value, 0) / scored.length;
  const parts = scored.map(({ label, value }) => `${label} ${value}`);
  return `${parts.join(' · ')} (sub-rating average ${average.toFixed(1)}, for reference)`;
}
