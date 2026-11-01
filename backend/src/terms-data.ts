// The terms to study. An id is kept once a user may have marked it, because learned_terms refers to it.
// Meanings are written for this app; do not copy them from an outside glossary.
export const TERM_DOMAINS = [
  { key: 'wine', label: '와인' },
  { key: 'whisky', label: '위스키' },
  { key: 'literature', label: '문학' },
  { key: 'movie', label: '영화' },
  { key: 'opera', label: '오페라' },
  { key: 'musical', label: '뮤지컬' },
] as const;

type DomainKey = (typeof TERM_DOMAINS)[number]['key'];

export type StudyTerm = {
  id: string;
  domain: DomainKey;
  term: string;
  original: string;
  meaning: string;
};

export const TERMS: StudyTerm[] = [
  {
    id: 'wine-tannin',
    domain: 'wine',
    term: '타닌',
    original: 'Tannin',
    meaning: '포도 껍질과 씨, 오크통에서 나오는 성분으로, 입안을 떫게 조이는 느낌을 준다.',
  },
  {
    id: 'wine-terroir',
    domain: 'wine',
    term: '테루아',
    original: 'Terroir',
    meaning: '토양, 기후, 지형처럼 포도가 자란 환경이 와인에 남기는 특성 전체를 가리킨다.',
  },
  {
    id: 'whisky-single-malt',
    domain: 'whisky',
    term: '싱글 몰트',
    original: 'Single Malt',
    meaning: '한 증류소에서 맥아 보리만으로 만든 위스키.',
  },
  {
    id: 'whisky-cask-strength',
    domain: 'whisky',
    term: '캐스크 스트렝스',
    original: 'Cask Strength',
    meaning: '물을 타서 도수를 낮추지 않고, 통에서 꺼낸 도수 그대로 병에 담은 위스키.',
  },
  {
    id: 'literature-foreshadowing',
    domain: 'literature',
    term: '복선',
    original: 'Foreshadowing',
    meaning: '뒤에 일어날 사건을 앞에서 넌지시 암시해 두는 기법.',
  },
  {
    id: 'literature-point-of-view',
    domain: 'literature',
    term: '시점',
    original: 'Point of View',
    meaning: '이야기를 누가 어떤 위치에서 전하는지를 가리키는 말.',
  },
  {
    id: 'movie-mise-en-scene',
    domain: 'movie',
    term: '미장센',
    original: 'Mise-en-scène',
    meaning: '배우, 조명, 소품처럼 한 화면 안에 보이는 요소를 배치하는 일.',
  },
  {
    id: 'movie-montage',
    domain: 'movie',
    term: '몽타주',
    original: 'Montage',
    meaning: '여러 장면을 이어 붙여 새로운 의미를 만드는 편집 기법.',
  },
  {
    id: 'opera-aria',
    domain: 'opera',
    term: '아리아',
    original: 'Aria',
    meaning: '등장인물이 감정을 펼쳐 보이는 독창곡.',
  },
  {
    id: 'opera-recitative',
    domain: 'opera',
    term: '레치타티보',
    original: 'Recitativo',
    meaning: '말하듯 노래하며 줄거리를 진행하는 부분.',
  },
  {
    id: 'musical-number',
    domain: 'musical',
    term: '넘버',
    original: 'Number',
    meaning: '뮤지컬에 나오는 노래 한 곡 한 곡을 가리키는 말.',
  },
  {
    id: 'musical-ensemble',
    domain: 'musical',
    term: '앙상블',
    original: 'Ensemble',
    meaning: '주역 외의 여러 배우가 함께 노래와 춤으로 무대를 채우는 배역.',
  },
];
