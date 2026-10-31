// Category rules follow backend/src/items.ts. The server checks every value again.
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
};

export type Category = {
  key: string;
  label: string;
  description: string;
  subtypes: { value: string; label: string }[];
  fields: { key: string; label: string; numeric?: boolean }[];
  criteria: { key: string; label: string }[];
};

export const SCORES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export const categories: Category[] = [
  {
    key: 'reading',
    label: '독서',
    description: '읽고 싶은 책과 읽은 책',
    subtypes: [],
    fields: [
      { key: 'author', label: '저자' },
      { key: 'publisher', label: '출판사' },
    ],
    criteria: [
      { key: 'content', label: '내용' },
      { key: 'prose', label: '문장' },
      { key: 'afterglow', label: '여운' },
    ],
  },
  {
    key: 'screen',
    label: '영화·드라마',
    description: '보고 싶은 영화·드라마와 본 작품',
    subtypes: [
      { value: 'movie', label: '영화' },
      { value: 'drama', label: '드라마' },
    ],
    fields: [
      { key: 'director', label: '감독' },
      { key: 'cast', label: '출연진' },
    ],
    criteria: [
      { key: 'story', label: '스토리' },
      { key: 'direction', label: '연출' },
      { key: 'acting', label: '연기' },
    ],
  },
  {
    key: 'stage',
    label: '공연',
    description: '연극·공연·뮤지컬·오페라',
    subtypes: [
      { value: 'play', label: '연극' },
      { value: 'performance', label: '공연' },
      { value: 'musical', label: '뮤지컬' },
      { value: 'opera', label: '오페라' },
    ],
    fields: [
      { key: 'venue', label: '공연장' },
      { key: 'cast', label: '출연진' },
    ],
    criteria: [
      { key: 'acting', label: '연기' },
      { key: 'direction', label: '연출' },
      { key: 'stage', label: '무대' },
      { key: 'music', label: '음악' },
    ],
  },
  {
    key: 'drink',
    label: '주류',
    description: '와인·위스키·사케',
    subtypes: [
      { value: 'wine', label: '와인' },
      { value: 'whisky', label: '위스키' },
      { value: 'sake', label: '사케' },
    ],
    fields: [
      { key: 'producer', label: '생산자' },
      { key: 'region', label: '산지' },
      { key: 'vintage', label: '빈티지', numeric: true },
    ],
    criteria: [
      { key: 'aroma', label: '향' },
      { key: 'taste', label: '맛' },
      { key: 'finish', label: '여운' },
      { key: 'value', label: '가성비' },
    ],
  },
  {
    key: 'travel',
    label: '여행',
    description: '가고 싶은 곳과 다녀온 곳',
    subtypes: [],
    fields: [
      { key: 'country', label: '나라' },
      { key: 'city', label: '도시' },
    ],
    criteria: [
      { key: 'scenery', label: '풍경' },
      { key: 'food', label: '음식' },
      { key: 'lodging', label: '숙소' },
      { key: 'transport', label: '교통' },
    ],
  },
];

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
function numberOrText(value: string) {
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
    details,
  };
}

export function itemSummary(item: Item, category: Category) {
  const parts = category.fields.flatMap(({ key, label }) => {
    const value = item.details[key];
    return value === undefined ? [] : [`${label} ${value}`];
  });
  if (item.costKrw !== null) parts.push(`비용 ${item.costKrw.toLocaleString('ko-KR')}원`);
  if (item.plannedDate) parts.push(`예정일 ${item.plannedDate}`);
  if (item.completedDate) parts.push(`완료일 ${item.completedDate}`);
  return parts;
}

export const MAX_REVIEW_LINES = 5;
export const MAX_REVIEW_LENGTH = 500;

/** The review as the server stores it, with its size. The server checks the same limits. */
export function measureReview(text: string) {
  const review = text.replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n').trim();
  return { review, lines: review ? review.split('\n').length : 0, length: review.length };
}

/** The first line that shows anything; zero-width characters alone would preview as a blank line. */
export function reviewPreview(review: string) {
  return review.split('\n').find((line) => /[^\s\u200b-\u200d\u2060\ufeff]/u.test(line)) ?? null;
}

export function reviewProblem({ lines, length }: { lines: number; length: number }) {
  if (lines > MAX_REVIEW_LINES) return `감상문은 ${MAX_REVIEW_LINES}줄 이하로 입력해 주세요`;
  if (length > MAX_REVIEW_LENGTH) return `감상문은 ${MAX_REVIEW_LENGTH}자 이하로 입력해 주세요`;
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
  return `${parts.join(' · ')} (세부 평균 ${average.toFixed(1)}, 참고용)`;
}
