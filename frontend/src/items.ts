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
};

export type Category = {
  key: string;
  label: string;
  description: string;
  subtypes: { value: string; label: string }[];
  fields: { key: string; label: string; numeric?: boolean }[];
};

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
