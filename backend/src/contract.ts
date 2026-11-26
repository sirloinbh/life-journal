// The item rules the API and the screens share (#146). This file is the only source: the frontend
// imports it, the backend gets a copy at backend/src/contract.ts (`npm run contract:sync`, checked
// by `npm run contract:check`). Adding a category takes an entry here and a migration that adds its
// key to the items.category CHECK constraint (database/migrations). Plain data only, no imports.

/** The scores a rating may take, lowest first. */
export const SCORES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export const MAX_REVIEW_LINES = 5;
export const MAX_REVIEW_LENGTH = 500;

/** Quotes of reading items (#217): the quoted text, an optional page, and an optional note. */
export const MAX_QUOTE_LENGTH = 1000;
export const MAX_QUOTE_NOTE_LENGTH = 500;
export const MAX_QUOTE_PAGE = 99999;
/** Free tags and companions of an item (#215): at most this many names per list, each this long at most. */
export const MAX_ITEM_NAMES = 20;
export const MAX_ITEM_NAME_LENGTH = 50;

/** A detail field: free text up to `maxLength` characters, or a 4-digit year sent as a number. */
export type DetailField =
  | { key: string; label: string; type: 'text'; maxLength: number }
  | { key: string; label: string; type: 'year' };

export type CategoryRule = {
  key: string;
  label: string;
  description: string;
  /** Empty when the category has no subtype; otherwise one of them is required. */
  subtypes: readonly { value: string; label: string }[];
  fields: readonly DetailField[];
  /** Sub-rating criteria. A label also names the criterion in the server's messages. */
  criteria: readonly { key: string; label: string }[];
};

/** In menu order, which is also the sort order of the category column. */
export const CATEGORIES = [
  {
    key: 'reading',
    label: 'Reading',
    description: 'Books to read and books read',
    subtypes: [],
    fields: [
      { key: 'author', label: 'Author', type: 'text', maxLength: 100 },
      { key: 'publisher', label: 'Publisher', type: 'text', maxLength: 100 },
    ],
    criteria: [
      { key: 'content', label: 'Content' },
      { key: 'prose', label: 'Prose' },
      { key: 'afterglow', label: 'Lingering impression' },
    ],
  },
  {
    key: 'screen',
    label: 'Movies & TV',
    description: 'Movies and TV dramas to watch and ones watched',
    subtypes: [
      { value: 'movie', label: 'Movie' },
      { value: 'drama', label: 'TV drama' },
    ],
    fields: [
      { key: 'director', label: 'Director', type: 'text', maxLength: 100 },
      { key: 'cast', label: 'Cast', type: 'text', maxLength: 200 },
    ],
    criteria: [
      { key: 'story', label: 'Story' },
      { key: 'direction', label: 'Direction' },
      { key: 'acting', label: 'Acting' },
    ],
  },
  {
    key: 'stage',
    label: 'Stage',
    description: 'Plays, performances, musicals, and operas',
    subtypes: [
      { value: 'play', label: 'Play' },
      { value: 'performance', label: 'Stage' },
      { value: 'musical', label: 'Musical' },
      { value: 'opera', label: 'Opera' },
    ],
    fields: [
      { key: 'venue', label: 'Venue', type: 'text', maxLength: 100 },
      { key: 'cast', label: 'Cast', type: 'text', maxLength: 200 },
    ],
    criteria: [
      { key: 'acting', label: 'Acting' },
      { key: 'direction', label: 'Direction' },
      { key: 'stage', label: 'Staging' },
      { key: 'music', label: 'Music' },
    ],
  },
  {
    key: 'drink',
    label: 'Drinks',
    description: 'Wine, whisky, and sake',
    subtypes: [
      { value: 'wine', label: 'Wine' },
      { value: 'whisky', label: 'Whisky' },
      { value: 'sake', label: 'Sake' },
    ],
    fields: [
      { key: 'producer', label: 'Producer', type: 'text', maxLength: 100 },
      { key: 'region', label: 'Region', type: 'text', maxLength: 100 },
      { key: 'vintage', label: 'Vintage', type: 'year' },
    ],
    criteria: [
      { key: 'aroma', label: 'Aroma' },
      { key: 'taste', label: 'Taste' },
      { key: 'finish', label: 'Lingering impression' },
      { key: 'value', label: 'Value' },
    ],
  },
  {
    key: 'travel',
    label: 'Travel',
    description: 'Places to visit and places visited',
    subtypes: [],
    fields: [
      { key: 'country', label: 'Country', type: 'text', maxLength: 100 },
      { key: 'city', label: 'City', type: 'text', maxLength: 100 },
    ],
    criteria: [
      { key: 'scenery', label: 'Scenery' },
      { key: 'food', label: 'Food' },
      { key: 'lodging', label: 'Lodging' },
      { key: 'transport', label: 'Transport' },
    ],
  },
  {
    key: 'coffee',
    label: 'Coffee',
    description: 'Coffee to try and coffee tried',
    subtypes: [],
    fields: [
      { key: 'roastery', label: 'Roastery', type: 'text', maxLength: 100 },
      { key: 'origin', label: 'Origin', type: 'text', maxLength: 100 },
      { key: 'brewMethod', label: 'Brew method', type: 'text', maxLength: 50 },
    ],
    criteria: [
      { key: 'aroma', label: 'Aroma' },
      { key: 'acidity', label: 'Acidity' },
      { key: 'sweetness', label: 'Sweetness' },
      { key: 'body', label: 'Body' },
      { key: 'finish', label: 'Lingering impression' },
    ],
  },
] as const satisfies readonly CategoryRule[];

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

/** The category keys in menu order, as a non-empty list for an enum. */
export const CATEGORY_KEYS = CATEGORIES.map(({ key }) => key) as [CategoryKey, ...CategoryKey[]];
