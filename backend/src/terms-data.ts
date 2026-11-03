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
  // 와인 — 품종: 포도 이름
  {
    id: 'wine-cabernet-sauvignon',
    domain: 'wine',
    term: '카베르네 소비뇽',
    original: 'Cabernet Sauvignon',
    meaning:
      '껍질이 두꺼운 적포도 품종으로, 타닌이 단단하고 블랙커런트 같은 검은 과일 향이 난다. 오래 숙성할수록 부드러워진다.',
  },
  {
    id: 'wine-merlot',
    domain: 'wine',
    term: '메를로',
    original: 'Merlot',
    meaning:
      '카베르네 소비뇽보다 타닌이 순하고 자두 같은 둥근 과일 맛이 나는 적포도 품종. 보르도에서 함께 섞는 일이 많다.',
  },
  {
    id: 'wine-pinot-noir',
    domain: 'wine',
    term: '피노 누아',
    original: 'Pinot Noir',
    meaning:
      '껍질이 얇아 색이 옅고 타닌이 적은 적포도 품종. 체리, 딸기 향과 섬세한 맛이 특징이며 서늘한 곳에서 잘 자란다.',
  },
  {
    id: 'wine-syrah',
    domain: 'wine',
    term: '시라',
    original: 'Syrah / Shiraz',
    meaning: '후추 같은 향신료 향과 진한 색을 내는 적포도 품종. 호주에서는 쉬라즈라고 부른다.',
  },
  {
    id: 'wine-grenache',
    domain: 'wine',
    term: '그르나슈',
    original: 'Grenache / Garnacha',
    meaning:
      '덥고 건조한 곳에서 잘 자라는 적포도 품종으로, 알코올이 높고 붉은 과일 맛이 풍부하다. 스페인에서는 가르나차라고 부른다.',
  },
  {
    id: 'wine-sangiovese',
    domain: 'wine',
    term: '산지오베제',
    original: 'Sangiovese',
    meaning: '이탈리아 토스카나의 대표 적포도 품종. 산도가 높고 체리, 허브 향이 난다.',
  },
  {
    id: 'wine-nebbiolo',
    domain: 'wine',
    term: '네비올로',
    original: 'Nebbiolo',
    meaning:
      '이탈리아 피에몬테의 적포도 품종. 색은 옅은 편이지만 타닌과 산도가 강하고 장미, 타르 같은 향이 난다.',
  },
  {
    id: 'wine-tempranillo',
    domain: 'wine',
    term: '템프라니요',
    original: 'Tempranillo',
    meaning:
      '스페인의 대표 적포도 품종. 오크통 숙성과 잘 어울려 가죽, 바닐라 향이 더해지는 일이 많다.',
  },
  {
    id: 'wine-malbec',
    domain: 'wine',
    term: '말벡',
    original: 'Malbec',
    meaning: '아르헨티나에서 널리 기르는 적포도 품종으로, 색이 짙고 잘 익은 검은 과일 맛이 난다.',
  },
  {
    id: 'wine-chardonnay',
    domain: 'wine',
    term: '샤르도네',
    original: 'Chardonnay',
    meaning:
      '가장 널리 기르는 청포도 품종 가운데 하나. 자란 곳과 양조 방식에 따라 상큼한 맛부터 버터처럼 진한 맛까지 폭이 넓다.',
  },
  {
    id: 'wine-sauvignon-blanc',
    domain: 'wine',
    term: '소비뇽 블랑',
    original: 'Sauvignon Blanc',
    meaning: '산뜻한 산도와 풀, 자몽 같은 향이 뚜렷한 청포도 품종.',
  },
  {
    id: 'wine-riesling',
    domain: 'wine',
    term: '리슬링',
    original: 'Riesling',
    meaning:
      '독일을 대표하는 청포도 품종. 산도가 높아 드라이부터 아주 단 와인까지 다양하게 만들고, 숙성하면 독특한 석유 향이 나기도 한다.',
  },
  // 와인 — 산지: 지역과 표시
  {
    id: 'wine-terroir',
    domain: 'wine',
    term: '테루아',
    original: 'Terroir',
    meaning: '토양, 기후, 지형처럼 포도가 자란 환경이 와인에 남기는 특성 전체를 가리킨다.',
  },
  {
    id: 'wine-bordeaux',
    domain: 'wine',
    term: '보르도',
    original: 'Bordeaux',
    meaning: '프랑스 남서부의 와인 산지. 여러 품종을 섞어 만드는 레드 와인으로 이름났다.',
  },
  {
    id: 'wine-bourgogne',
    domain: 'wine',
    term: '부르고뉴',
    original: 'Bourgogne / Burgundy',
    meaning:
      '프랑스 동부의 와인 산지. 레드는 피노 누아, 화이트는 샤르도네 한 품종만으로 만드는 일이 많고, 밭 단위로 등급을 나눈다.',
  },
  {
    id: 'wine-champagne',
    domain: 'wine',
    term: '샹파뉴',
    original: 'Champagne',
    meaning:
      '프랑스 북동부의 산지. 이곳에서 정해진 방식으로 만든 발포성 와인만 샴페인이라고 부를 수 있다.',
  },
  {
    id: 'wine-rhone',
    domain: 'wine',
    term: '론',
    original: 'Rhône',
    meaning:
      '프랑스 남동부 론강을 따라 있는 산지. 북쪽은 시라, 남쪽은 그르나슈를 중심으로 섞은 와인이 많다.',
  },
  {
    id: 'wine-tuscany',
    domain: 'wine',
    term: '토스카나',
    original: 'Toscana / Tuscany',
    meaning: '이탈리아 중부의 산지. 산지오베제로 만드는 키안티가 잘 알려져 있다.',
  },
  {
    id: 'wine-piedmont',
    domain: 'wine',
    term: '피에몬테',
    original: 'Piemonte / Piedmont',
    meaning: '이탈리아 북서부의 산지. 네비올로로 만드는 바롤로와 바르바레스코가 유명하다.',
  },
  {
    id: 'wine-rioja',
    domain: 'wine',
    term: '리오하',
    original: 'Rioja',
    meaning: '스페인 북부의 산지. 템프라니요를 오크통에서 숙성한 레드 와인이 대표적이다.',
  },
  {
    id: 'wine-mosel',
    domain: 'wine',
    term: '모젤',
    original: 'Mosel',
    meaning: '독일 서부 모젤강 주변의 산지. 가파른 비탈 밭에서 기른 리슬링으로 이름났다.',
  },
  {
    id: 'wine-napa-valley',
    domain: 'wine',
    term: '나파 밸리',
    original: 'Napa Valley',
    meaning: '미국 캘리포니아의 산지. 진하고 잘 익은 맛의 카베르네 소비뇽으로 알려져 있다.',
  },
  {
    id: 'wine-appellation',
    domain: 'wine',
    term: '원산지 명칭',
    original: 'Appellation',
    meaning:
      '포도를 기른 지역을 라벨에 쓸 수 있게 법으로 정한 이름. 유럽에서는 그 지역에서 쓸 수 있는 품종과 방식도 함께 정한다. 프랑스의 AOC가 대표적이다.',
  },
  {
    id: 'wine-old-world',
    domain: 'wine',
    term: '구대륙',
    original: 'Old World',
    meaning:
      '프랑스, 이탈리아, 스페인, 독일처럼 오래전부터 와인을 만들어 온 유럽 산지를 묶어 부르는 말. 라벨에 품종보다 지역을 앞세우는 일이 많다.',
  },
  {
    id: 'wine-new-world',
    domain: 'wine',
    term: '신대륙',
    original: 'New World',
    meaning:
      '미국, 호주, 칠레, 아르헨티나처럼 유럽 밖에서 와인 산업이 자란 산지를 묶어 부르는 말. 라벨에 품종을 크게 적는 일이 많다.',
  },
  // 와인 — 양조: 만드는 과정
  {
    id: 'wine-vintage',
    domain: 'wine',
    term: '빈티지',
    original: 'Vintage',
    meaning: '와인을 만든 포도를 수확한 해. 그해 날씨에 따라 맛이 달라지므로 라벨에 적는다.',
  },
  {
    id: 'wine-blend',
    domain: 'wine',
    term: '블렌딩',
    original: 'Blending',
    meaning: '여러 품종이나 여러 통의 와인을 섞어 맛의 균형을 맞추는 일.',
  },
  {
    id: 'wine-alcoholic-fermentation',
    domain: 'wine',
    term: '알코올 발효',
    original: 'Alcoholic Fermentation',
    meaning:
      '효모가 포도즙의 당분을 먹고 알코올과 이산화탄소를 만드는 과정. 포도즙이 와인이 되는 단계다.',
  },
  {
    id: 'wine-malolactic-fermentation',
    domain: 'wine',
    term: '젖산 발효',
    original: 'Malolactic Fermentation',
    meaning:
      '젖산균이 날카로운 사과산을 부드러운 젖산으로 바꾸는 과정. 보통 알코올 발효 뒤에 일어나며, 산미가 둥글어지고 버터 같은 향이 생길 수 있다.',
  },
  {
    id: 'wine-maceration',
    domain: 'wine',
    term: '침용',
    original: 'Maceration',
    meaning:
      '포도즙을 껍질과 함께 담가 두어 색, 타닌, 향을 우려내는 과정. 레드 와인의 색은 대부분 여기서 나온다.',
  },
  {
    id: 'wine-oak-aging',
    domain: 'wine',
    term: '오크 숙성',
    original: 'Oak Aging',
    meaning:
      '와인을 참나무통에 넣어 익히는 일. 바닐라, 토스트 같은 향이 더해지고 맛이 부드러워진다.',
  },
  {
    id: 'wine-sur-lie',
    domain: 'wine',
    term: '쉬르 리',
    original: 'Sur Lie',
    meaning:
      '발효가 끝난 뒤 가라앉은 효모 찌꺼기 위에 와인을 그대로 두고 숙성하는 방법. 질감이 풍부해지고 빵 같은 향이 생길 수 있다.',
  },
  {
    id: 'wine-traditional-method',
    domain: 'wine',
    term: '전통 방식',
    original: 'Méthode Traditionnelle',
    meaning:
      '병 안에서 두 번째 발효를 일으켜 거품을 만드는 발포성 와인 제조법. 샴페인을 이 방식으로 만든다.',
  },
  {
    id: 'wine-noble-rot',
    domain: 'wine',
    term: '귀부',
    original: 'Noble Rot',
    meaning:
      '특정 곰팡이가 잘 익은 포도에 붙어 수분을 빼내는 현상. 당분이 진해져 아주 단 디저트 와인을 만든다.',
  },
  {
    id: 'wine-fortified-wine',
    domain: 'wine',
    term: '주정 강화 와인',
    original: 'Fortified Wine',
    meaning: '만드는 도중에 증류주를 더해 도수를 높인 와인. 포트와 셰리가 대표적이다.',
  },
  {
    id: 'wine-natural-wine',
    domain: 'wine',
    term: '내추럴 와인',
    original: 'Natural Wine',
    meaning:
      '포도밭과 양조장에서 사람의 개입과 첨가물을 최소로 줄여 만든 와인. 법으로 정한 공통 기준은 아직 없다.',
  },
  {
    id: 'wine-sulfites',
    domain: 'wine',
    term: '아황산염',
    original: 'Sulfites',
    meaning:
      '와인이 상하거나 산화하지 않도록 넣는 보존 성분. 발효 중에도 조금 생기며, 많은 나라에서 일정량을 넘으면 라벨에 표시하게 한다.',
  },
  // 와인 — 시음 표현: 맛과 향을 말하는 법
  {
    id: 'wine-tannin',
    domain: 'wine',
    term: '타닌',
    original: 'Tannin',
    meaning: '포도 껍질과 씨, 오크통에서 나오는 성분으로, 입안을 떫게 조이는 느낌을 준다.',
  },
  {
    id: 'wine-body',
    domain: 'wine',
    term: '바디',
    original: 'Body',
    meaning:
      '입안에서 느껴지는 와인의 무게감. 물처럼 가벼우면 라이트 바디, 우유처럼 묵직하면 풀 바디라고 한다.',
  },
  {
    id: 'wine-acidity',
    domain: 'wine',
    term: '산도',
    original: 'Acidity',
    meaning: '와인의 신맛 정도. 산도가 높으면 침이 고이고 맛이 생기 있게 느껴진다.',
  },
  {
    id: 'wine-dry',
    domain: 'wine',
    term: '드라이',
    original: 'Dry',
    meaning: '남은 당분이 거의 없어 단맛이 느껴지지 않는 상태. 스위트의 반대말로 쓴다.',
  },
  {
    id: 'wine-finish',
    domain: 'wine',
    term: '여운',
    original: 'Finish',
    meaning: '와인을 삼킨 뒤 입안에 맛과 향이 남는 시간. 길수록 좋은 와인으로 여기는 일이 많다.',
  },
  {
    id: 'wine-aroma',
    domain: 'wine',
    term: '아로마',
    original: 'Aroma',
    meaning: '포도 품종과 발효에서 오는 향. 과일, 꽃, 풀 냄새처럼 비교적 어린 와인에서 느껴진다.',
  },
  {
    id: 'wine-bouquet',
    domain: 'wine',
    term: '부케',
    original: 'Bouquet',
    meaning: '숙성하면서 새로 생기는 복합적인 향. 가죽, 버섯, 견과 같은 냄새로 표현한다.',
  },
  {
    id: 'wine-balance',
    domain: 'wine',
    term: '균형',
    original: 'Balance',
    meaning: '산도, 타닌, 단맛, 알코올 가운데 어느 하나가 튀지 않고 조화를 이룬 상태.',
  },
  {
    id: 'wine-minerality',
    domain: 'wine',
    term: '미네랄리티',
    original: 'Minerality',
    meaning:
      '젖은 돌이나 분필을 떠올리게 하는 맛과 향을 가리키는 표현. 어디서 오는지는 아직 의견이 갈린다.',
  },
  {
    id: 'wine-legs',
    domain: 'wine',
    term: '레그',
    original: 'Legs / Tears',
    meaning:
      '잔을 돌린 뒤 안쪽 벽을 타고 흘러내리는 와인 줄기. 알코올이나 당분이 많을수록 잘 보이며, 품질과는 직접 관계가 없다.',
  },
  {
    id: 'wine-swirling',
    domain: 'wine',
    term: '스월링',
    original: 'Swirling',
    meaning: '잔을 둥글게 돌려 와인이 공기와 닿게 하는 동작. 향이 잘 올라오게 한다.',
  },
  {
    id: 'wine-decanting',
    domain: 'wine',
    term: '디캔팅',
    original: 'Decanting',
    meaning: '와인을 다른 병에 옮겨 담아 공기와 닿게 하거나, 오래된 와인의 찌꺼기를 걸러 내는 일.',
  },
  {
    id: 'wine-corked',
    domain: 'wine',
    term: '부쇼네',
    original: 'Corked / Bouchonné',
    meaning:
      '오염된 코르크 때문에 젖은 종이나 곰팡이 냄새가 나는 상태. 마시기 전에 와인을 맛보는 이유 가운데 하나다.',
  },
  // 위스키 — 종류: 원료와 섞는 방식
  {
    id: 'whisky-single-malt',
    domain: 'whisky',
    term: '싱글 몰트',
    original: 'Single Malt',
    meaning: '한 증류소에서 맥아 보리만으로 만든 위스키.',
  },
  {
    id: 'whisky-blended-malt',
    domain: 'whisky',
    term: '블렌디드 몰트',
    original: 'Blended Malt',
    meaning:
      '여러 증류소의 몰트위스키만 섞은 위스키. 보리 맥아에 밀이나 옥수수 같은 다른 곡물을 더해 만든 그레인위스키는 넣지 않는다.',
  },
  {
    id: 'whisky-blended',
    domain: 'whisky',
    term: '블렌디드 위스키',
    original: 'Blended Whisky',
    meaning: '몰트위스키와 그레인위스키를 섞어 만든 위스키. 맛이 고르고 부드러워 가장 많이 팔린다.',
  },
  {
    id: 'whisky-grain',
    domain: 'whisky',
    term: '그레인위스키',
    original: 'Grain Whisky',
    meaning:
      '밀이나 옥수수 같은 곡물을 연속식 증류기로 증류해 만든 위스키. 몰트위스키보다 맛이 가볍다.',
  },
  {
    id: 'whisky-single-grain',
    domain: 'whisky',
    term: '싱글 그레인',
    original: 'Single Grain',
    meaning: '한 증류소에서 만든 그레인위스키만 담은 위스키.',
  },
  {
    id: 'whisky-bourbon',
    domain: 'whisky',
    term: '버번',
    original: 'Bourbon',
    meaning:
      '옥수수를 절반 넘게 쓰고, 안쪽을 불에 그을린 새 오크통에서 숙성한 미국 위스키. 단맛과 바닐라 향이 뚜렷하다.',
  },
  {
    id: 'whisky-tennessee',
    domain: 'whisky',
    term: '테네시 위스키',
    original: 'Tennessee Whiskey',
    meaning:
      '미국 테네시주에서 만드는 위스키. 대부분 숙성 전에 단풍나무 숯에 통과시켜 맛을 부드럽게 한다.',
  },
  {
    id: 'whisky-rye',
    domain: 'whisky',
    term: '라이 위스키',
    original: 'Rye Whiskey',
    meaning:
      '호밀을 많이 써서 만든 위스키. 미국에서는 호밀이 절반을 넘어야 하며, 알싸한 향신료 맛이 난다.',
  },
  {
    id: 'whisky-single-pot-still',
    domain: 'whisky',
    term: '싱글 팟 스틸',
    original: 'Single Pot Still',
    meaning:
      '싹을 틔운 보리와 싹을 틔우지 않은 보리를 섞어 한 증류소의 단식 증류기로 만든 아일랜드 위스키. 크림 같은 질감이 특징이다.',
  },
  {
    id: 'whisky-single-cask',
    domain: 'whisky',
    term: '싱글 캐스크',
    original: 'Single Cask',
    meaning:
      '통 하나에서 꺼낸 위스키를 다른 통과 섞지 않고 그대로 담은 것. 통 하나에서만 담아 병 수가 적고, 통마다 맛이 다르다.',
  },
  {
    id: 'whisky-small-batch',
    domain: 'whisky',
    term: '스몰 배치',
    original: 'Small Batch',
    meaning:
      '적은 수의 통만 골라 섞었다는 뜻으로 붙이는 말. 몇 통까지인지 법으로 정한 기준은 없다.',
  },
  {
    id: 'whisky-bottled-in-bond',
    domain: 'whisky',
    term: '보틀드 인 본드',
    original: 'Bottled-in-Bond',
    meaning:
      '한 증류소에서 한 철에 증류해 정부 감독 창고에서 4년 이상 숙성하고 100프루프로 담은 미국 위스키에 붙는 표시.',
  },
  // 위스키 — 산지: 나라와 지역
  {
    id: 'whisky-scotch',
    domain: 'whisky',
    term: '스카치위스키',
    original: 'Scotch Whisky',
    meaning: '스코틀랜드에서 증류하고 그곳의 오크통에서 3년 이상 숙성한 위스키.',
  },
  {
    id: 'whisky-speyside',
    domain: 'whisky',
    term: '스페이사이드',
    original: 'Speyside',
    meaning:
      '스코틀랜드 스페이강 주변 지역. 증류소가 가장 많이 모여 있고, 과일과 꽃 향이 나는 우아한 위스키가 많다.',
  },
  {
    id: 'whisky-highland',
    domain: 'whisky',
    term: '하일랜드',
    original: 'Highlands',
    meaning:
      '스코틀랜드 북부의 넓은 지역. 땅이 넓은 만큼 가벼운 맛부터 묵직한 맛까지 위스키 성격이 다양하다.',
  },
  {
    id: 'whisky-islay',
    domain: 'whisky',
    term: '아일라',
    original: 'Islay',
    meaning: '스코틀랜드 서쪽의 섬. 피트 연기 향이 강한 위스키로 유명하다.',
  },
  {
    id: 'whisky-lowland',
    domain: 'whisky',
    term: '로랜드',
    original: 'Lowlands',
    meaning: '스코틀랜드 남부 지역. 가볍고 부드러운 위스키가 많다.',
  },
  {
    id: 'whisky-campbeltown',
    domain: 'whisky',
    term: '캠벨타운',
    original: 'Campbeltown',
    meaning:
      '스코틀랜드 서남쪽 반도의 작은 항구 마을. 한때 증류소가 많았으나 지금은 몇 곳만 남았고, 짠맛과 기름진 질감이 특징으로 꼽힌다.',
  },
  {
    id: 'whisky-islands',
    domain: 'whisky',
    term: '아일랜즈',
    original: 'Islands',
    meaning:
      '아일라를 뺀 스코틀랜드의 섬들을 묶어 부르는 말. 공식 구분에서는 하일랜드에 속하지만 바닷바람 느낌의 위스키가 많아 따로 부르곤 한다.',
  },
  {
    id: 'whisky-irish',
    domain: 'whisky',
    term: '아이리시위스키',
    original: 'Irish Whiskey',
    meaning: '아일랜드섬에서 만들고 3년 이상 숙성한 위스키. 세 번 증류해 부드러운 것이 많다.',
  },
  {
    id: 'whisky-kentucky',
    domain: 'whisky',
    term: '켄터키',
    original: 'Kentucky',
    meaning: '미국 버번의 대부분을 만드는 주. 다만 버번은 미국 어디서 만들어도 된다.',
  },
  {
    id: 'whisky-japanese',
    domain: 'whisky',
    term: '재패니즈위스키',
    original: 'Japanese Whisky',
    meaning:
      '일본에서 만든 위스키. 스카치를 본보기로 시작했으며, 일본 업계는 2021년부터 일본에서 증류하고 숙성한 것에만 이 이름을 쓰도록 기준을 두었다.',
  },
  {
    id: 'whisky-canadian',
    domain: 'whisky',
    term: '캐나디언위스키',
    original: 'Canadian Whisky',
    meaning: '캐나다에서 3년 이상 숙성한 위스키. 여러 곡물 원액을 섞어 가볍고 부드러운 것이 많다.',
  },
  {
    id: 'whisky-world',
    domain: 'whisky',
    term: '월드 위스키',
    original: 'World Whisky',
    meaning:
      '스코틀랜드, 아일랜드, 미국, 캐나다, 일본 같은 전통 산지 밖에서 만든 위스키를 묶어 부르는 말. 대만, 인도, 한국 위스키 등이 있다.',
  },
  // 위스키 — 증류와 숙성: 만드는 과정
  {
    id: 'whisky-malting',
    domain: 'whisky',
    term: '몰팅',
    original: 'Malting',
    meaning:
      '보리를 물에 불려 싹을 틔운 뒤 말리는 과정. 녹말이 당분으로 바뀔 준비를 한다. 이때 피트를 태워 말리면 연기 향이 밴다.',
  },
  {
    id: 'whisky-mashing',
    domain: 'whisky',
    term: '당화',
    original: 'Mashing',
    meaning:
      '빻은 맥아를 뜨거운 물에 담가 당분을 우려내는 과정. 이렇게 얻은 단 액체를 워트라고 한다.',
  },
  {
    id: 'whisky-wash',
    domain: 'whisky',
    term: '워시',
    original: 'Wash',
    meaning: '워트에 효모를 넣어 발효한 액체. 맥주와 비슷하며 이것을 증류해 위스키 원액을 얻는다.',
  },
  {
    id: 'whisky-pot-still',
    domain: 'whisky',
    term: '단식 증류기',
    original: 'Pot Still',
    meaning:
      '원료를 한 번에 정해진 양만큼 넣어 끓여 증류하는 구리 증류기. 맛 성분이 많이 남아 몰트위스키를 만들 때 쓴다.',
  },
  {
    id: 'whisky-column-still',
    domain: 'whisky',
    term: '연속식 증류기',
    original: 'Column Still',
    meaning:
      '기둥 모양의 증류기로, 쉬지 않고 원료를 넣어 연달아 증류한다. 도수가 높고 가벼운 원액을 많이 만들 수 있다.',
  },
  {
    id: 'whisky-new-make',
    domain: 'whisky',
    term: '뉴 메이크',
    original: 'New Make Spirit',
    meaning:
      '증류기에서 막 나와 아직 통에 넣지 않은 투명한 원액. 스코틀랜드 등에서는 정해진 기간 숙성을 거쳐야 위스키라고 부를 수 있다.',
  },
  {
    id: 'whisky-angels-share',
    domain: 'whisky',
    term: '엔젤스 셰어',
    original: "Angel's Share",
    meaning:
      '숙성하는 동안 통 밖으로 증발해 사라지는 위스키. 천사가 몫을 가져간다는 뜻으로 이렇게 부른다.',
  },
  {
    id: 'whisky-bourbon-cask',
    domain: 'whisky',
    term: '버번 캐스크',
    original: 'Ex-Bourbon Cask',
    meaning:
      '버번을 숙성하는 데 한 번 쓴 오크통. 스카치 숙성에 가장 많이 쓰며 바닐라와 꿀 같은 향을 더한다.',
  },
  {
    id: 'whisky-sherry-cask',
    domain: 'whisky',
    term: '셰리 캐스크',
    original: 'Sherry Cask',
    meaning:
      '스페인의 주정 강화 와인인 셰리를 담았던 오크통. 말린 과일, 견과, 향신료 같은 진한 맛을 더한다.',
  },
  {
    id: 'whisky-cask-finish',
    domain: 'whisky',
    term: '캐스크 피니시',
    original: 'Cask Finish',
    meaning:
      '한 통에서 숙성한 위스키를 다른 종류의 통으로 옮겨 짧게 더 익히는 방법. 마지막 통의 향을 덧입힌다.',
  },
  {
    id: 'whisky-age-statement',
    domain: 'whisky',
    term: '숙성 연수 표기',
    original: 'Age Statement',
    meaning:
      '라벨의 12년, 18년 같은 숫자. 병에 섞인 위스키 가운데 가장 짧게 숙성한 것의 햇수를 적는다.',
  },
  {
    id: 'whisky-chill-filtration',
    domain: 'whisky',
    term: '냉각 여과',
    original: 'Chill Filtration',
    meaning:
      '위스키를 차갑게 식혀 걸러 내는 일. 얼음이나 물을 넣었을 때 뿌옇게 흐려지지 않게 하지만, 맛 성분도 일부 빠진다는 의견이 있다.',
  },
  {
    id: 'whisky-cask-strength',
    domain: 'whisky',
    term: '캐스크 스트렝스',
    original: 'Cask Strength',
    meaning: '물을 타서 도수를 낮추지 않고, 통에서 꺼낸 도수 그대로 병에 담은 위스키.',
  },
  // 위스키 — 시음 표현과 마시는 법
  {
    id: 'whisky-nose',
    domain: 'whisky',
    term: '노즈',
    original: 'Nose',
    meaning: '잔에 코를 대고 맡는 향. 시음 기록에서 향을 적는 항목 이름으로도 쓴다.',
  },
  {
    id: 'whisky-palate',
    domain: 'whisky',
    term: '팔레트',
    original: 'Palate',
    meaning: '입에 머금었을 때 느껴지는 맛. 시음 기록에서 맛을 적는 항목 이름으로도 쓴다.',
  },
  {
    id: 'whisky-finish',
    domain: 'whisky',
    term: '피니시',
    original: 'Finish',
    meaning: '삼킨 뒤 입과 목에 남는 맛과 향, 그리고 그것이 이어지는 시간.',
  },
  {
    id: 'whisky-peaty',
    domain: 'whisky',
    term: '피티',
    original: 'Peaty',
    meaning: '피트를 태운 연기에서 온 흙, 연기, 소독약 같은 향을 가리키는 표현.',
  },
  {
    id: 'whisky-smoky',
    domain: 'whisky',
    term: '스모키',
    original: 'Smoky',
    meaning: '모닥불이나 훈제처럼 연기를 떠올리게 하는 향. 피트 말고 그을린 통에서 오기도 한다.',
  },
  {
    id: 'whisky-sherried',
    domain: 'whisky',
    term: '셰리 풍미',
    original: 'Sherried',
    meaning: '셰리 캐스크에서 온 건포도, 무화과, 초콜릿 같은 달고 진한 맛을 가리키는 표현.',
  },
  {
    id: 'whisky-mouthfeel',
    domain: 'whisky',
    term: '마우스필',
    original: 'Mouthfeel',
    meaning: '입안에서 느껴지는 질감. 가볍다, 기름지다, 크림 같다처럼 표현한다.',
  },
  {
    id: 'whisky-neat',
    domain: 'whisky',
    term: '니트',
    original: 'Neat',
    meaning: '얼음이나 물을 넣지 않고 상온의 위스키를 그대로 마시는 방법.',
  },
  {
    id: 'whisky-on-the-rocks',
    domain: 'whisky',
    term: '온 더 록',
    original: 'On the Rocks',
    meaning: '잔에 얼음을 넣고 위스키를 부어 차갑게 마시는 방법. 차가워지면서 향은 조금 약해진다.',
  },
  {
    id: 'whisky-highball',
    domain: 'whisky',
    term: '하이볼',
    original: 'Highball',
    meaning: '위스키에 탄산수와 얼음을 넣어 길게 마시는 음료.',
  },
  {
    id: 'whisky-adding-water',
    domain: 'whisky',
    term: '가수',
    original: 'Adding Water',
    meaning:
      '위스키에 물을 몇 방울 떨어뜨리는 일. 도수가 조금 낮아지면서 숨어 있던 향이 올라오기도 한다.',
  },
  {
    id: 'whisky-abv',
    domain: 'whisky',
    term: '알코올 도수',
    original: 'ABV',
    meaning: '술에 든 알코올의 부피 비율. 라벨에 40%처럼 적는다.',
  },
  {
    id: 'whisky-proof',
    domain: 'whisky',
    term: '프루프',
    original: 'Proof',
    meaning: '미국에서 쓰는 도수 표기. 알코올 도수의 두 배로, 100프루프는 50%다.',
  },
  // 문학 — 갈래: 작품의 종류
  {
    id: 'literature-epic',
    domain: 'literature',
    term: '서사시',
    original: 'Epic',
    meaning: '영웅이나 민족의 큰 사건을 긴 이야기로 풀어낸 시.',
  },
  {
    id: 'literature-lyric-poetry',
    domain: 'literature',
    term: '서정시',
    original: 'Lyric Poetry',
    meaning: '말하는 이의 느낌과 생각을 짧고 압축된 말로 드러내는 시.',
  },
  {
    id: 'literature-prose-poem',
    domain: 'literature',
    term: '산문시',
    original: 'Prose Poem',
    meaning: '행을 나누지 않고 문장을 이어 쓰지만, 시의 리듬과 압축을 지닌 시.',
  },
  {
    id: 'literature-short-story',
    domain: 'literature',
    term: '단편소설',
    original: 'Short Story',
    meaning: '한 번에 읽을 만한 길이로, 적은 인물과 하나의 중심 사건에 집중하는 소설.',
  },
  {
    id: 'literature-novella',
    domain: 'literature',
    term: '중편소설',
    original: 'Novella',
    meaning: '단편보다 길고 장편보다 짧은 소설. 사건은 하나에 집중하되 인물을 좀 더 깊이 그린다.',
  },
  {
    id: 'literature-play',
    domain: 'literature',
    term: '희곡',
    original: 'Play / Drama',
    meaning: '무대에서 공연하기 위해 대사와 지문으로 쓴 글.',
  },
  {
    id: 'literature-essay',
    domain: 'literature',
    term: '수필',
    original: 'Essay',
    meaning: '글쓴이가 겪은 일이나 생각을 정해진 형식 없이 자유롭게 쓴 글.',
  },
  {
    id: 'literature-tragedy',
    domain: 'literature',
    term: '비극',
    original: 'Tragedy',
    meaning: '주인공이 결함이나 운명 때문에 몰락하는 과정을 그려 슬픔과 깨달음을 주는 극.',
  },
  {
    id: 'literature-comedy',
    domain: 'literature',
    term: '희극',
    original: 'Comedy',
    meaning: '웃음을 자아내는 인물과 사건으로 이야기를 이끌며, 대개 행복하게 끝나는 극.',
  },
  {
    id: 'literature-bildungsroman',
    domain: 'literature',
    term: '성장소설',
    original: 'Bildungsroman',
    meaning: '어린 주인공이 여러 일을 겪으며 어른으로 자라 가는 과정을 그린 소설.',
  },
  {
    id: 'literature-dystopia',
    domain: 'literature',
    term: '디스토피아 소설',
    original: 'Dystopian Fiction',
    meaning: '통제나 억압이 심한 어두운 미래 사회를 그려 지금의 문제를 비추는 소설.',
  },
  {
    id: 'literature-magical-realism',
    domain: 'literature',
    term: '마술적 사실주의',
    original: 'Magical Realism',
    meaning:
      '현실 속에서 초자연적인 일이 아무렇지 않게 일어나는 것처럼 그리는 기법. 라틴아메리카 소설에서 널리 쓰였다.',
  },
  // 문학 — 서술 기법: 이야기를 전하는 방법
  {
    id: 'literature-point-of-view',
    domain: 'literature',
    term: '시점',
    original: 'Point of View',
    meaning: '이야기를 누가 어떤 위치에서 전하는지를 가리키는 말.',
  },
  {
    id: 'literature-narrator',
    domain: 'literature',
    term: '서술자',
    original: 'Narrator',
    meaning: '작품 안에서 이야기를 들려주는 목소리. 작가 자신과는 구별한다.',
  },
  {
    id: 'literature-first-person-protagonist',
    domain: 'literature',
    term: '1인칭 주인공 시점',
    original: 'First-Person Protagonist',
    meaning: "주인공이 '나'가 되어 자기 이야기를 하는 방식. 속마음을 직접 드러내기 쉽다.",
  },
  {
    id: 'literature-first-person-observer',
    domain: 'literature',
    term: '1인칭 관찰자 시점',
    original: 'First-Person Observer',
    meaning:
      "주변 인물인 '나'가 주인공을 지켜보며 이야기하는 방식. 주인공의 속마음은 짐작으로만 전한다.",
  },
  {
    id: 'literature-third-person-observer',
    domain: 'literature',
    term: '3인칭 관찰자 시점',
    original: 'Third-Person Objective',
    meaning: '작품 밖의 서술자가 인물의 말과 행동만 보여 주는 방식. 속마음은 독자가 짐작하게 둔다.',
  },
  {
    id: 'literature-omniscient',
    domain: 'literature',
    term: '전지적 작가 시점',
    original: 'Omniscient Point of View',
    meaning: '작품 밖의 서술자가 모든 인물의 속마음과 사정까지 알고 전하는 방식.',
  },
  {
    id: 'literature-unreliable-narrator',
    domain: 'literature',
    term: '믿을 수 없는 서술자',
    original: 'Unreliable Narrator',
    meaning:
      '착각, 거짓말, 편견 때문에 말을 그대로 믿기 어려운 서술자. 독자가 숨은 진실을 스스로 찾게 한다.',
  },
  {
    id: 'literature-stream-of-consciousness',
    domain: 'literature',
    term: '의식의 흐름',
    original: 'Stream of Consciousness',
    meaning: '인물의 머릿속에 떠오르는 생각과 감각을 논리나 순서 없이 이어지는 그대로 옮기는 기법.',
  },
  {
    id: 'literature-interior-monologue',
    domain: 'literature',
    term: '내적 독백',
    original: 'Interior Monologue',
    meaning: '인물이 소리 내지 않고 속으로 하는 말을 그대로 보여 주는 기법.',
  },
  {
    id: 'literature-free-indirect-discourse',
    domain: 'literature',
    term: '자유 간접 화법',
    original: 'Free Indirect Discourse',
    meaning: '3인칭 서술 속에 인물의 생각을 따옴표 없이 그 인물의 말투로 섞어 쓰는 방법.',
  },
  {
    id: 'literature-showing-telling',
    domain: 'literature',
    term: '보여 주기와 말하기',
    original: 'Showing and Telling',
    meaning: '장면과 행동으로 드러내는 보여 주기와, 서술자가 직접 설명하는 말하기를 구분하는 말.',
  },
  {
    id: 'literature-epistolary',
    domain: 'literature',
    term: '서간체',
    original: 'Epistolary Form',
    meaning: '편지를 주고받는 형식으로 이야기를 전개하는 방식.',
  },
  {
    id: 'literature-tone',
    domain: 'literature',
    term: '어조',
    original: 'Tone',
    meaning:
      '작품에 드러나는 말하는 이의 태도와 말투. 다정한, 냉소적인, 담담한 같은 말로 표현한다.',
  },
  // 문학 — 구성: 이야기의 짜임
  {
    id: 'literature-plot',
    domain: 'literature',
    term: '플롯',
    original: 'Plot',
    meaning: '사건을 일어난 순서가 아니라 원인과 결과에 따라 짜 놓은 이야기의 뼈대.',
  },
  {
    id: 'literature-exposition',
    domain: 'literature',
    term: '발단',
    original: 'Exposition',
    meaning: '인물과 배경이 소개되고 사건의 실마리가 나타나는 이야기의 첫 단계.',
  },
  {
    id: 'literature-conflict',
    domain: 'literature',
    term: '갈등',
    original: 'Conflict',
    meaning:
      '인물과 인물, 인물과 사회, 또는 인물 마음속에서 서로 맞서는 힘. 이야기를 움직이는 원동력이다.',
  },
  {
    id: 'literature-climax',
    domain: 'literature',
    term: '절정',
    original: 'Climax',
    meaning: '갈등이 가장 높아져 사건의 방향이 결정되는 순간.',
  },
  {
    id: 'literature-denouement',
    domain: 'literature',
    term: '대단원',
    original: 'Denouement',
    meaning: '절정 뒤에 얽힌 사건이 풀리고 인물의 운명이 정리되는 마지막 단계.',
  },
  {
    id: 'literature-foreshadowing',
    domain: 'literature',
    term: '복선',
    original: 'Foreshadowing',
    meaning: '뒤에 일어날 사건을 앞에서 넌지시 암시해 두는 기법.',
  },
  {
    id: 'literature-flashback',
    domain: 'literature',
    term: '회상',
    original: 'Flashback',
    meaning: '현재 이야기를 잠시 멈추고 과거의 일을 보여 주는 기법.',
  },
  {
    id: 'literature-frame-story',
    domain: 'literature',
    term: '액자식 구성',
    original: 'Frame Story',
    meaning:
      '바깥 이야기 안에 또 다른 이야기를 넣는 짜임. 사진을 액자에 끼운 모습에 빗댄 이름이다.',
  },
  {
    id: 'literature-in-medias-res',
    domain: 'literature',
    term: '인 메디아스 레스',
    original: 'In Medias Res',
    meaning: '처음부터가 아니라 사건 한가운데서 이야기를 시작하는 방법. 앞선 일은 나중에 밝힌다.',
  },
  {
    id: 'literature-picaresque',
    domain: 'literature',
    term: '피카레스크식 구성',
    original: 'Picaresque Structure',
    meaning: '떠돌아다니는 주인공이 겪는 독립된 일화들을 차례로 이어 놓은 짜임.',
  },
  {
    id: 'literature-open-ending',
    domain: 'literature',
    term: '열린 결말',
    original: 'Open Ending',
    meaning: '이야기의 끝을 분명히 정하지 않고 독자의 해석에 맡기는 결말.',
  },
  {
    id: 'literature-protagonist',
    domain: 'literature',
    term: '주동 인물',
    original: 'Protagonist',
    meaning: '이야기의 중심에서 사건을 이끌어 가는 인물.',
  },
  {
    id: 'literature-antagonist',
    domain: 'literature',
    term: '반동 인물',
    original: 'Antagonist',
    meaning: '주동 인물과 맞서며 갈등을 일으키는 인물이나 세력.',
  },
  // 문학 — 수사법: 표현을 꾸미는 방법
  {
    id: 'literature-simile',
    domain: 'literature',
    term: '직유법',
    original: 'Simile',
    meaning: "'~처럼', '~같이'를 써서 두 대상을 직접 견주는 표현.",
  },
  {
    id: 'literature-metaphor',
    domain: 'literature',
    term: '은유법',
    original: 'Metaphor',
    meaning: "견주는 말 없이 'A는 B다'처럼 한 대상을 다른 대상으로 바로 바꿔 말하는 표현.",
  },
  {
    id: 'literature-personification',
    domain: 'literature',
    term: '의인법',
    original: 'Personification',
    meaning: '사람이 아닌 것을 사람처럼 생각하고 행동하는 것으로 그리는 표현.',
  },
  {
    id: 'literature-symbol',
    domain: 'literature',
    term: '상징',
    original: 'Symbol',
    meaning: '구체적인 사물로 눈에 보이지 않는 생각이나 감정을 대신 나타내는 것.',
  },
  {
    id: 'literature-irony',
    domain: 'literature',
    term: '반어법',
    original: 'Irony',
    meaning: '속뜻과 반대로 말해 뜻을 더 강하게 전하는 표현.',
  },
  {
    id: 'literature-paradox',
    domain: 'literature',
    term: '역설법',
    original: 'Paradox',
    meaning: '겉으로는 앞뒤가 맞지 않지만 그 안에 진실을 담은 표현.',
  },
  {
    id: 'literature-hyperbole',
    domain: 'literature',
    term: '과장법',
    original: 'Hyperbole',
    meaning: '실제보다 훨씬 크거나 작게 부풀려 말해 느낌을 강조하는 표현.',
  },
  {
    id: 'literature-parallelism',
    domain: 'literature',
    term: '대구법',
    original: 'Parallelism',
    meaning: '짜임이 비슷한 구절을 나란히 놓아 리듬과 대비를 만드는 표현.',
  },
  {
    id: 'literature-repetition',
    domain: 'literature',
    term: '반복법',
    original: 'Repetition',
    meaning: '같은 말이나 구절을 되풀이해 뜻을 강조하고 운율을 만드는 표현.',
  },
  {
    id: 'literature-inversion',
    domain: 'literature',
    term: '도치법',
    original: 'Inversion',
    meaning: '말의 정상적인 순서를 바꿔 강조하고 싶은 부분을 앞에 두는 표현.',
  },
  {
    id: 'literature-rhetorical-question',
    domain: 'literature',
    term: '설의법',
    original: 'Rhetorical Question',
    meaning: '답이 정해진 내용을 일부러 물음 꼴로 던져 강조하는 표현.',
  },
  {
    id: 'literature-allusion',
    domain: 'literature',
    term: '인유법',
    original: 'Allusion',
    meaning: '널리 알려진 작품, 인물, 사건을 끌어와 뜻을 넓히는 표현.',
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
