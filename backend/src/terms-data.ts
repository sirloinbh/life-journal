// The terms to study. An id is kept once a user may have marked it, because learned_terms refers to it.
// Meanings are written for this app; do not copy them from an outside glossary.
export const TERM_DOMAINS = [
  { key: 'wine', label: 'Wine' },
  { key: 'whisky', label: 'Whisky' },
  { key: 'literature', label: 'Literature' },
  { key: 'movie', label: 'Movies' },
  { key: 'opera', label: 'Opera' },
  { key: 'musical', label: 'Musicals' },
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
  // Wine — Grapes: names of grape varieties
  {
    id: 'wine-cabernet-sauvignon',
    domain: 'wine',
    term: 'Cabernet Sauvignon',
    original: 'Cabernet Sauvignon',
    meaning:
      'A thick-skinned red grape with firm tannins and dark fruit notes such as blackcurrant. It softens the longer it ages.',
  },
  {
    id: 'wine-merlot',
    domain: 'wine',
    term: 'Merlot',
    original: 'Merlot',
    meaning:
      'A red grape with softer tannins than Cabernet Sauvignon and round, plum-like fruit. It is often blended with it in Bordeaux.',
  },
  {
    id: 'wine-pinot-noir',
    domain: 'wine',
    term: 'Pinot Noir',
    original: 'Pinot Noir',
    meaning:
      'A thin-skinned red grape that gives pale color and low tannin. Known for cherry and strawberry notes and delicate flavor, it grows best in cool places.',
  },
  {
    id: 'wine-syrah',
    domain: 'wine',
    term: 'Syrah / Shiraz',
    original: 'Syrah / Shiraz',
    meaning:
      'A red grape with deep color and peppery spice notes. It is called Shiraz in Australia.',
  },
  {
    id: 'wine-grenache',
    domain: 'wine',
    term: 'Grenache / Garnacha',
    original: 'Grenache / Garnacha',
    meaning:
      'A red grape that thrives in hot, dry places, giving high alcohol and rich red fruit flavor. It is called Garnacha in Spain.',
  },
  {
    id: 'wine-sangiovese',
    domain: 'wine',
    term: 'Sangiovese',
    original: 'Sangiovese',
    meaning:
      'The signature red grape of Tuscany, Italy, with high acidity and cherry and herb notes.',
  },
  {
    id: 'wine-nebbiolo',
    domain: 'wine',
    term: 'Nebbiolo',
    original: 'Nebbiolo',
    meaning:
      'A red grape from Piedmont, Italy. Pale in color but strong in tannin and acidity, with notes of rose and tar.',
  },
  {
    id: 'wine-tempranillo',
    domain: 'wine',
    term: 'Tempranillo',
    original: 'Tempranillo',
    meaning:
      'The signature red grape of Spain. It pairs well with oak aging, which often adds leather and vanilla notes.',
  },
  {
    id: 'wine-malbec',
    domain: 'wine',
    term: 'Malbec',
    original: 'Malbec',
    meaning: 'A red grape widely grown in Argentina, with deep color and ripe dark fruit flavor.',
  },
  {
    id: 'wine-chardonnay',
    domain: 'wine',
    term: 'Chardonnay',
    original: 'Chardonnay',
    meaning:
      'One of the most widely grown white grapes. Depending on where it grows and how it is made, it ranges from crisp to rich and buttery.',
  },
  {
    id: 'wine-sauvignon-blanc',
    domain: 'wine',
    term: 'Sauvignon Blanc',
    original: 'Sauvignon Blanc',
    meaning: 'A white grape with bright acidity and clear grass and grapefruit notes.',
  },
  {
    id: 'wine-riesling',
    domain: 'wine',
    term: 'Riesling',
    original: 'Riesling',
    meaning:
      'The signature white grape of Germany. Its high acidity makes everything from dry to very sweet wines, and with age it can develop a distinctive petrol note.',
  },
  // Wine — Regions: places and labeling
  {
    id: 'wine-terroir',
    domain: 'wine',
    term: 'Terroir',
    original: 'Terroir',
    meaning:
      'The sum of what the growing environment, such as soil, climate, and terrain, leaves in a wine.',
  },
  {
    id: 'wine-bordeaux',
    domain: 'wine',
    term: 'Bordeaux',
    original: 'Bordeaux',
    meaning: 'A wine region in southwest France, famous for red wines blended from several grapes.',
  },
  {
    id: 'wine-bourgogne',
    domain: 'wine',
    term: 'Bourgogne / Burgundy',
    original: 'Bourgogne / Burgundy',
    meaning:
      'A wine region in eastern France. Reds are often pure Pinot Noir and whites pure Chardonnay, and vineyards are ranked plot by plot.',
  },
  {
    id: 'wine-champagne',
    domain: 'wine',
    term: 'Champagne',
    original: 'Champagne',
    meaning:
      'A region in northeast France. Only sparkling wine made here by the set method may be called Champagne.',
  },
  {
    id: 'wine-rhone',
    domain: 'wine',
    term: 'Rhône',
    original: 'Rhône',
    meaning:
      'A region along the Rhône river in southeast France. The north centers on Syrah and the south on Grenache-based blends.',
  },
  {
    id: 'wine-tuscany',
    domain: 'wine',
    term: 'Toscana / Tuscany',
    original: 'Toscana / Tuscany',
    meaning: 'A region in central Italy, well known for Chianti made from Sangiovese.',
  },
  {
    id: 'wine-piedmont',
    domain: 'wine',
    term: 'Piemonte / Piedmont',
    original: 'Piemonte / Piedmont',
    meaning: 'A region in northwest Italy, famous for Barolo and Barbaresco made from Nebbiolo.',
  },
  {
    id: 'wine-rioja',
    domain: 'wine',
    term: 'Rioja',
    original: 'Rioja',
    meaning:
      'A region in northern Spain, best known for red wine made from Tempranillo and aged in oak.',
  },
  {
    id: 'wine-mosel',
    domain: 'wine',
    term: 'Mosel',
    original: 'Mosel',
    meaning:
      'A region around the Mosel river in western Germany, known for Riesling grown on steep slopes.',
  },
  {
    id: 'wine-napa-valley',
    domain: 'wine',
    term: 'Napa Valley',
    original: 'Napa Valley',
    meaning: 'A region in California, USA, known for rich, ripe Cabernet Sauvignon.',
  },
  {
    id: 'wine-appellation',
    domain: 'wine',
    term: 'Appellation',
    original: 'Appellation',
    meaning:
      'A legally defined name that lets the label state where the grapes were grown. In Europe it also sets the grapes and methods allowed there. The French AOC is the best-known example.',
  },
  {
    id: 'wine-old-world',
    domain: 'wine',
    term: 'Old World',
    original: 'Old World',
    meaning:
      'A collective name for long-established European wine regions such as France, Italy, Spain, and Germany. Labels often put the region ahead of the grape.',
  },
  {
    id: 'wine-new-world',
    domain: 'wine',
    term: 'New World',
    original: 'New World',
    meaning:
      'A collective name for wine regions outside Europe, such as the USA, Australia, Chile, and Argentina. Labels often show the grape in large type.',
  },
  // Wine — Winemaking: how it is made
  {
    id: 'wine-vintage',
    domain: 'wine',
    term: 'Vintage',
    original: 'Vintage',
    meaning:
      'The year the grapes for a wine were harvested. It goes on the label because the weather that year changes the taste.',
  },
  {
    id: 'wine-blend',
    domain: 'wine',
    term: 'Blending',
    original: 'Blending',
    meaning: 'Mixing several grapes or several barrels of wine to balance the flavor.',
  },
  {
    id: 'wine-alcoholic-fermentation',
    domain: 'wine',
    term: 'Alcoholic Fermentation',
    original: 'Alcoholic Fermentation',
    meaning:
      'The process in which yeast eats the sugar in grape juice and makes alcohol and carbon dioxide. It is the step that turns juice into wine.',
  },
  {
    id: 'wine-malolactic-fermentation',
    domain: 'wine',
    term: 'Malolactic Fermentation',
    original: 'Malolactic Fermentation',
    meaning:
      'A process in which bacteria turn sharp malic acid into softer lactic acid. It usually follows alcoholic fermentation, rounding the acidity and sometimes adding a buttery note.',
  },
  {
    id: 'wine-maceration',
    domain: 'wine',
    term: 'Maceration',
    original: 'Maceration',
    meaning:
      "Soaking grape juice with the skins to draw out color, tannin, and aroma. Most of a red wine's color comes from this step.",
  },
  {
    id: 'wine-oak-aging',
    domain: 'wine',
    term: 'Oak Aging',
    original: 'Oak Aging',
    meaning:
      'Maturing wine in oak barrels. It adds notes such as vanilla and toast and softens the taste.',
  },
  {
    id: 'wine-sur-lie',
    domain: 'wine',
    term: 'Sur Lie',
    original: 'Sur Lie',
    meaning:
      'Leaving the wine on the settled yeast sediment after fermentation while it ages. It can add a richer texture and a bready note.',
  },
  {
    id: 'wine-traditional-method',
    domain: 'wine',
    term: 'Méthode Traditionnelle',
    original: 'Méthode Traditionnelle',
    meaning:
      'A way of making sparkling wine by causing a second fermentation inside the bottle to create bubbles. Champagne is made this way.',
  },
  {
    id: 'wine-noble-rot',
    domain: 'wine',
    term: 'Noble Rot',
    original: 'Noble Rot',
    meaning:
      'A phenomenon in which a particular mold attaches to ripe grapes and draws out their water. The sugar becomes concentrated, making very sweet dessert wines.',
  },
  {
    id: 'wine-fortified-wine',
    domain: 'wine',
    term: 'Fortified Wine',
    original: 'Fortified Wine',
    meaning:
      'Wine with a distilled spirit added during production to raise its strength. Port and sherry are typical examples.',
  },
  {
    id: 'wine-natural-wine',
    domain: 'wine',
    term: 'Natural Wine',
    original: 'Natural Wine',
    meaning:
      'Wine made with as little human intervention and as few additives as possible in the vineyard and winery. There is still no common legal standard.',
  },
  {
    id: 'wine-sulfites',
    domain: 'wine',
    term: 'Sulfites',
    original: 'Sulfites',
    meaning:
      'A preservative added so wine does not spoil or oxidize. A little also forms during fermentation, and many countries require a label notice above a set amount.',
  },
  // Wine — Tasting: how to describe taste and aroma
  {
    id: 'wine-tannin',
    domain: 'wine',
    term: 'Tannin',
    original: 'Tannin',
    meaning:
      'A compound from grape skins, seeds, and oak barrels that gives a drying, gripping feeling in the mouth.',
  },
  {
    id: 'wine-body',
    domain: 'wine',
    term: 'Body',
    original: 'Body',
    meaning:
      'The weight of a wine in the mouth. Light like water is light-bodied; heavy like milk is full-bodied.',
  },
  {
    id: 'wine-acidity',
    domain: 'wine',
    term: 'Acidity',
    original: 'Acidity',
    meaning:
      'How sour a wine tastes. High acidity makes your mouth water and the wine feel lively.',
  },
  {
    id: 'wine-dry',
    domain: 'wine',
    term: 'Dry',
    original: 'Dry',
    meaning:
      'A state with almost no sugar left, so no sweetness is noticeable. It is used as the opposite of sweet.',
  },
  {
    id: 'wine-finish',
    domain: 'wine',
    term: 'Finish',
    original: 'Finish',
    meaning:
      'How long the taste and aroma stay in your mouth after you swallow. A longer finish is often seen as a sign of a better wine.',
  },
  {
    id: 'wine-aroma',
    domain: 'wine',
    term: 'Aroma',
    original: 'Aroma',
    meaning:
      'The scent that comes from the grape and from fermentation, such as fruit, flowers, and grass. It is mostly found in young wines.',
  },
  {
    id: 'wine-bouquet',
    domain: 'wine',
    term: 'Bouquet',
    original: 'Bouquet',
    meaning:
      'The complex scent that develops as a wine ages, described with notes such as leather, mushroom, and nuts.',
  },
  {
    id: 'wine-balance',
    domain: 'wine',
    term: 'Balance',
    original: 'Balance',
    meaning:
      'A state in which acidity, tannin, sweetness, and alcohol are in harmony and none of them stands out.',
  },
  {
    id: 'wine-minerality',
    domain: 'wine',
    term: 'Minerality',
    original: 'Minerality',
    meaning:
      'A term for tastes and aromas that recall wet stone or chalk. Opinions still differ on where it comes from.',
  },
  {
    id: 'wine-legs',
    domain: 'wine',
    term: 'Legs / Tears',
    original: 'Legs / Tears',
    meaning:
      'The streaks of wine that run down the inside of the glass after you swirl it. They show more with more alcohol or sugar and have no direct link to quality.',
  },
  {
    id: 'wine-swirling',
    domain: 'wine',
    term: 'Swirling',
    original: 'Swirling',
    meaning: 'Moving the glass in circles so the wine meets air. It helps the aroma rise.',
  },
  {
    id: 'wine-decanting',
    domain: 'wine',
    term: 'Decanting',
    original: 'Decanting',
    meaning:
      'Pouring wine into another vessel to let it meet air, or to filter the sediment out of an old wine.',
  },
  {
    id: 'wine-corked',
    domain: 'wine',
    term: 'Corked / Bouchonné',
    original: 'Corked / Bouchonné',
    meaning:
      'A state in which a tainted cork gives the wine a smell of wet paper or mold. It is one reason wine is tasted before drinking.',
  },
  // Whisky — Types: ingredients and blending
  {
    id: 'whisky-single-malt',
    domain: 'whisky',
    term: 'Single Malt',
    original: 'Single Malt',
    meaning: 'Whisky made at a single distillery from malted barley only.',
  },
  {
    id: 'whisky-blended-malt',
    domain: 'whisky',
    term: 'Blended Malt',
    original: 'Blended Malt',
    meaning:
      'Whisky made by blending malt whiskies from several distilleries only. It contains no grain whisky, which is made from other grains such as wheat or corn.',
  },
  {
    id: 'whisky-blended',
    domain: 'whisky',
    term: 'Blended Whisky',
    original: 'Blended Whisky',
    meaning:
      'Whisky made by blending malt whisky and grain whisky. Its even, smooth taste makes it the best seller.',
  },
  {
    id: 'whisky-grain',
    domain: 'whisky',
    term: 'Grain Whisky',
    original: 'Grain Whisky',
    meaning:
      'Whisky made from grains such as wheat or corn distilled in a continuous still. It tastes lighter than malt whisky.',
  },
  {
    id: 'whisky-single-grain',
    domain: 'whisky',
    term: 'Single Grain',
    original: 'Single Grain',
    meaning: 'Whisky made only from grain whisky from a single distillery.',
  },
  {
    id: 'whisky-bourbon',
    domain: 'whisky',
    term: 'Bourbon',
    original: 'Bourbon',
    meaning:
      'An American whiskey made with more than half corn and aged in new, charred oak barrels. Sweetness and vanilla are clear.',
  },
  {
    id: 'whisky-tennessee',
    domain: 'whisky',
    term: 'Tennessee Whiskey',
    original: 'Tennessee Whiskey',
    meaning:
      'Whiskey made in Tennessee, USA. Most is passed through maple charcoal before aging to soften the taste.',
  },
  {
    id: 'whisky-rye',
    domain: 'whisky',
    term: 'Rye Whiskey',
    original: 'Rye Whiskey',
    meaning:
      'Whiskey made with a lot of rye. In the USA rye must be more than half the grain, and it tastes of sharp spice.',
  },
  {
    id: 'whisky-single-pot-still',
    domain: 'whisky',
    term: 'Single Pot Still',
    original: 'Single Pot Still',
    meaning:
      'An Irish whiskey made at one distillery in pot stills from a mix of malted and unmalted barley. It is known for a creamy texture.',
  },
  {
    id: 'whisky-single-cask',
    domain: 'whisky',
    term: 'Single Cask',
    original: 'Single Cask',
    meaning:
      'Whisky bottled straight from one cask without mixing with others. Because it comes from a single cask, few bottles exist and each cask tastes different.',
  },
  {
    id: 'whisky-small-batch',
    domain: 'whisky',
    term: 'Small Batch',
    original: 'Small Batch',
    meaning:
      'A label used to say only a small number of casks were selected and blended. There is no legal standard for how many casks that means.',
  },
  {
    id: 'whisky-bottled-in-bond',
    domain: 'whisky',
    term: 'Bottled-in-Bond',
    original: 'Bottled-in-Bond',
    meaning:
      'A mark on American whiskey distilled by one distillery in one season, aged at least four years in a government-supervised warehouse, and bottled at 100 proof.',
  },
  // Whisky — Regions: countries and areas
  {
    id: 'whisky-scotch',
    domain: 'whisky',
    term: 'Scotch Whisky',
    original: 'Scotch Whisky',
    meaning: 'Whisky distilled in Scotland and aged at least three years in oak casks there.',
  },
  {
    id: 'whisky-speyside',
    domain: 'whisky',
    term: 'Speyside',
    original: 'Speyside',
    meaning:
      'The area around the Spey river in Scotland. It has the most distilleries, and many of its whiskies are elegant with fruit and floral notes.',
  },
  {
    id: 'whisky-highland',
    domain: 'whisky',
    term: 'Highlands',
    original: 'Highlands',
    meaning:
      'A large area in northern Scotland. Being so wide, its whiskies range from light to heavy in character.',
  },
  {
    id: 'whisky-islay',
    domain: 'whisky',
    term: 'Islay',
    original: 'Islay',
    meaning: 'An island off western Scotland, famous for whiskies with strong peat smoke.',
  },
  {
    id: 'whisky-lowland',
    domain: 'whisky',
    term: 'Lowlands',
    original: 'Lowlands',
    meaning: 'The southern area of Scotland. Many of its whiskies are light and soft.',
  },
  {
    id: 'whisky-campbeltown',
    domain: 'whisky',
    term: 'Campbeltown',
    original: 'Campbeltown',
    meaning:
      'A small harbor town on a peninsula in southwest Scotland. It once had many distilleries but only a few remain, and its whisky is known for a salty taste and an oily texture.',
  },
  {
    id: 'whisky-islands',
    domain: 'whisky',
    term: 'Islands',
    original: 'Islands',
    meaning:
      'A collective name for the Scottish islands other than Islay. Officially part of the Highlands, many of its whiskies have a sea-breeze character, so it is often named separately.',
  },
  {
    id: 'whisky-irish',
    domain: 'whisky',
    term: 'Irish Whiskey',
    original: 'Irish Whiskey',
    meaning:
      'Whiskey made on the island of Ireland and aged at least three years. Many are triple distilled and smooth.',
  },
  {
    id: 'whisky-kentucky',
    domain: 'whisky',
    term: 'Kentucky',
    original: 'Kentucky',
    meaning:
      'The state that makes most American bourbon. Bourbon, however, may be made anywhere in the USA.',
  },
  {
    id: 'whisky-japanese',
    domain: 'whisky',
    term: 'Japanese Whisky',
    original: 'Japanese Whisky',
    meaning:
      'Whisky made in Japan. It began by taking Scotch as a model, and since 2021 the Japanese industry has set a standard that only whisky distilled and aged in Japan may use this name.',
  },
  {
    id: 'whisky-canadian',
    domain: 'whisky',
    term: 'Canadian Whisky',
    original: 'Canadian Whisky',
    meaning:
      'Whisky aged at least three years in Canada. Many are light and smooth, made by blending spirits from several grains.',
  },
  {
    id: 'whisky-world',
    domain: 'whisky',
    term: 'World Whisky',
    original: 'World Whisky',
    meaning:
      'A collective name for whisky made outside the traditional regions of Scotland, Ireland, the USA, Canada, and Japan. Examples include Taiwanese, Indian, and Korean whisky.',
  },
  // Whisky — Distilling and aging: how it is made
  {
    id: 'whisky-malting',
    domain: 'whisky',
    term: 'Malting',
    original: 'Malting',
    meaning:
      'The process of soaking barley in water to sprout, then drying it. The starch prepares to turn into sugar. Drying it over burning peat adds a smoky scent.',
  },
  {
    id: 'whisky-mashing',
    domain: 'whisky',
    term: 'Mashing',
    original: 'Mashing',
    meaning:
      'The process of steeping ground malt in hot water to draw out sugar. The sweet liquid obtained is called wort.',
  },
  {
    id: 'whisky-wash',
    domain: 'whisky',
    term: 'Wash',
    original: 'Wash',
    meaning:
      'The liquid made by fermenting wort with yeast. It resembles beer and is distilled to get the whisky spirit.',
  },
  {
    id: 'whisky-pot-still',
    domain: 'whisky',
    term: 'Pot Still',
    original: 'Pot Still',
    meaning:
      'A copper still that boils and distills one fixed batch at a time. It keeps many flavor compounds, so it is used for malt whisky.',
  },
  {
    id: 'whisky-column-still',
    domain: 'whisky',
    term: 'Column Still',
    original: 'Column Still',
    meaning:
      'A column-shaped still that distills continuously as material is fed in. It can make a lot of high-strength, light spirit.',
  },
  {
    id: 'whisky-new-make',
    domain: 'whisky',
    term: 'New Make Spirit',
    original: 'New Make Spirit',
    meaning:
      'The clear spirit fresh off the still, not yet put into a cask. In Scotland and elsewhere it must be aged for a set period before it may be called whisky.',
  },
  {
    id: 'whisky-angels-share',
    domain: 'whisky',
    term: "Angel's Share",
    original: "Angel's Share",
    meaning:
      'Whisky that evaporates out of the cask during aging and is lost. The name means the angels take their share.',
  },
  {
    id: 'whisky-bourbon-cask',
    domain: 'whisky',
    term: 'Ex-Bourbon Cask',
    original: 'Ex-Bourbon Cask',
    meaning:
      'An oak cask already used once to age bourbon. It is the most common cask for Scotch aging and adds notes of vanilla and honey.',
  },
  {
    id: 'whisky-sherry-cask',
    domain: 'whisky',
    term: 'Sherry Cask',
    original: 'Sherry Cask',
    meaning:
      'An oak cask that held sherry, the fortified wine of Spain. It adds rich flavors of dried fruit, nuts, and spice.',
  },
  {
    id: 'whisky-cask-finish',
    domain: 'whisky',
    term: 'Cask Finish',
    original: 'Cask Finish',
    meaning:
      "A method of moving whisky aged in one cask into a different type of cask for a short extra maturation, adding the last cask's character.",
  },
  {
    id: 'whisky-age-statement',
    domain: 'whisky',
    term: 'Age Statement',
    original: 'Age Statement',
    meaning:
      'The number on the label, such as 12 or 18 years. It states the age of the youngest whisky in the bottle.',
  },
  {
    id: 'whisky-chill-filtration',
    domain: 'whisky',
    term: 'Chill Filtration',
    original: 'Chill Filtration',
    meaning:
      'Chilling whisky and filtering it. It keeps the whisky from turning cloudy when ice or water is added, but some argue it also removes some flavor compounds.',
  },
  {
    id: 'whisky-cask-strength',
    domain: 'whisky',
    term: 'Cask Strength',
    original: 'Cask Strength',
    meaning:
      'Whisky bottled at the strength it came out of the cask, without water added to lower it.',
  },
  // Whisky — Tasting and drinking
  {
    id: 'whisky-nose',
    domain: 'whisky',
    term: 'Nose',
    original: 'Nose',
    meaning:
      'The scent you get with your nose in the glass. Also the name of the field for aroma in tasting notes.',
  },
  {
    id: 'whisky-palate',
    domain: 'whisky',
    term: 'Palate',
    original: 'Palate',
    meaning:
      'The taste you get when you hold it in your mouth. Also the name of the field for taste in tasting notes.',
  },
  {
    id: 'whisky-finish',
    domain: 'whisky',
    term: 'Finish',
    original: 'Finish',
    meaning:
      'The taste and aroma that remain in the mouth and throat after swallowing, and how long they last.',
  },
  {
    id: 'whisky-peaty',
    domain: 'whisky',
    term: 'Peaty',
    original: 'Peaty',
    meaning: 'A term for earthy, smoky, medicinal notes that come from the smoke of burning peat.',
  },
  {
    id: 'whisky-smoky',
    domain: 'whisky',
    term: 'Smoky',
    original: 'Smoky',
    meaning:
      'A scent that recalls a campfire or smoked food. It can come from charred casks as well as peat.',
  },
  {
    id: 'whisky-sherried',
    domain: 'whisky',
    term: 'Sherried',
    original: 'Sherried',
    meaning:
      'A term for the sweet, rich flavors of raisin, fig, and chocolate that come from sherry casks.',
  },
  {
    id: 'whisky-mouthfeel',
    domain: 'whisky',
    term: 'Mouthfeel',
    original: 'Mouthfeel',
    meaning: 'The texture felt in the mouth, described as light, oily, or creamy.',
  },
  {
    id: 'whisky-neat',
    domain: 'whisky',
    term: 'Neat',
    original: 'Neat',
    meaning: 'Drinking whisky as it is, at room temperature, with no ice or water.',
  },
  {
    id: 'whisky-on-the-rocks',
    domain: 'whisky',
    term: 'On the Rocks',
    original: 'On the Rocks',
    meaning:
      'Drinking whisky poured over ice so it is cold. The aroma weakens a little as it chills.',
  },
  {
    id: 'whisky-highball',
    domain: 'whisky',
    term: 'Highball',
    original: 'Highball',
    meaning: 'A long drink of whisky with soda water and ice.',
  },
  {
    id: 'whisky-adding-water',
    domain: 'whisky',
    term: 'Adding Water',
    original: 'Adding Water',
    meaning:
      'Dropping a few drops of water into whisky. The strength falls a little, and hidden aromas can rise.',
  },
  {
    id: 'whisky-abv',
    domain: 'whisky',
    term: 'ABV',
    original: 'ABV',
    meaning: 'The volume share of alcohol in a drink, written on the label as, for example, 40%.',
  },
  {
    id: 'whisky-proof',
    domain: 'whisky',
    term: 'Proof',
    original: 'Proof',
    meaning:
      'The strength measure used in the USA. It is twice the alcohol percentage, so 100 proof is 50%.',
  },
  // Literature — Genres: kinds of works
  {
    id: 'literature-epic',
    domain: 'literature',
    term: 'Epic',
    original: 'Epic',
    meaning: 'A long narrative poem that tells of the great deeds of a hero or a people.',
  },
  {
    id: 'literature-lyric-poetry',
    domain: 'literature',
    term: 'Lyric Poetry',
    original: 'Lyric Poetry',
    meaning:
      "A poem that expresses the speaker's feelings and thoughts in short, compressed language.",
  },
  {
    id: 'literature-prose-poem',
    domain: 'literature',
    term: 'Prose Poem',
    original: 'Prose Poem',
    meaning:
      'A poem written in continuous sentences without line breaks, but with the rhythm and compression of poetry.',
  },
  {
    id: 'literature-short-story',
    domain: 'literature',
    term: 'Short Story',
    original: 'Short Story',
    meaning:
      'A work of fiction short enough to read in one sitting, focused on few characters and one central event.',
  },
  {
    id: 'literature-novella',
    domain: 'literature',
    term: 'Novella',
    original: 'Novella',
    meaning:
      'Fiction longer than a short story and shorter than a novel. It focuses on one event but draws its characters in more depth.',
  },
  {
    id: 'literature-play',
    domain: 'literature',
    term: 'Play / Drama',
    original: 'Play / Drama',
    meaning: 'A text written with dialogue and stage directions to be performed on stage.',
  },
  {
    id: 'literature-essay',
    domain: 'literature',
    term: 'Essay',
    original: 'Essay',
    meaning:
      'A piece in which the writer freely sets down experiences or thoughts in no fixed form.',
  },
  {
    id: 'literature-tragedy',
    domain: 'literature',
    term: 'Tragedy',
    original: 'Tragedy',
    meaning:
      "A drama that shows a hero's fall through a flaw or fate, bringing sorrow and insight.",
  },
  {
    id: 'literature-comedy',
    domain: 'literature',
    term: 'Comedy',
    original: 'Comedy',
    meaning: 'A drama driven by amusing characters and events, usually ending happily.',
  },
  {
    id: 'literature-bildungsroman',
    domain: 'literature',
    term: 'Bildungsroman',
    original: 'Bildungsroman',
    meaning:
      'A novel that follows a young protagonist growing into adulthood through many experiences.',
  },
  {
    id: 'literature-dystopia',
    domain: 'literature',
    term: 'Dystopian Fiction',
    original: 'Dystopian Fiction',
    meaning:
      "Fiction set in a dark future society of heavy control or oppression, reflecting today's problems.",
  },
  {
    id: 'literature-magical-realism',
    domain: 'literature',
    term: 'Magical Realism',
    original: 'Magical Realism',
    meaning:
      'A trend in fiction in which supernatural events happen in the real world as if they were ordinary. It was widely used in Latin American fiction.',
  },
  // Literature — Narration: ways of telling a story
  {
    id: 'literature-point-of-view',
    domain: 'literature',
    term: 'Point of View',
    original: 'Point of View',
    meaning: 'A term for who tells the story and from what position.',
  },
  {
    id: 'literature-narrator',
    domain: 'literature',
    term: 'Narrator',
    original: 'Narrator',
    meaning: 'The voice that tells the story within a work. It is distinguished from the author.',
  },
  {
    id: 'literature-first-person-protagonist',
    domain: 'literature',
    term: 'First-Person Protagonist',
    original: 'First-Person Protagonist',
    meaning:
      'A mode in which the protagonist is "I" and tells their own story. It makes it easy to reveal inner thoughts directly.',
  },
  {
    id: 'literature-first-person-observer',
    domain: 'literature',
    term: 'First-Person Observer',
    original: 'First-Person Observer',
    meaning:
      'A mode in which a minor character, "I", watches the protagonist and tells the story. The protagonist\'s inner thoughts are conveyed only by guesswork.',
  },
  {
    id: 'literature-third-person-observer',
    domain: 'literature',
    term: 'Third-Person Objective',
    original: 'Third-Person Objective',
    meaning:
      'A mode in which a narrator outside the work shows only what characters say and do. Inner thoughts are left for the reader to guess.',
  },
  {
    id: 'literature-omniscient',
    domain: 'literature',
    term: 'Omniscient Point of View',
    original: 'Omniscient Point of View',
    meaning:
      "A mode in which a narrator outside the work knows and tells every character's inner thoughts and circumstances.",
  },
  {
    id: 'literature-unreliable-narrator',
    domain: 'literature',
    term: 'Unreliable Narrator',
    original: 'Unreliable Narrator',
    meaning:
      'A narrator whose words are hard to take at face value because of delusion, lies, or bias. It leaves readers to find the hidden truth themselves.',
  },
  {
    id: 'literature-stream-of-consciousness',
    domain: 'literature',
    term: 'Stream of Consciousness',
    original: 'Stream of Consciousness',
    meaning:
      "A technique that records the thoughts and sensations in a character's mind as they come, without logic or order.",
  },
  {
    id: 'literature-interior-monologue',
    domain: 'literature',
    term: 'Interior Monologue',
    original: 'Interior Monologue',
    meaning: 'A technique that shows what a character says silently to themselves.',
  },
  {
    id: 'literature-free-indirect-discourse',
    domain: 'literature',
    term: 'Free Indirect Discourse',
    original: 'Free Indirect Discourse',
    meaning:
      "A way of mixing a character's thoughts into third-person narration in that character's own voice, without quotation marks.",
  },
  {
    id: 'literature-showing-telling',
    domain: 'literature',
    term: 'Showing and Telling',
    original: 'Showing and Telling',
    meaning:
      'A pair of terms: showing reveals through scenes and actions, while telling has the narrator explain directly.',
  },
  {
    id: 'literature-epistolary',
    domain: 'literature',
    term: 'Epistolary Form',
    original: 'Epistolary Form',
    meaning: 'A way of developing a story through an exchange of letters.',
  },
  {
    id: 'literature-tone',
    domain: 'literature',
    term: 'Tone',
    original: 'Tone',
    meaning:
      "The speaker's attitude and manner of speaking in a work, described with words like warm, cynical, or calm.",
  },
  // Literature — Structure: how a story is built
  {
    id: 'literature-plot',
    domain: 'literature',
    term: 'Plot',
    original: 'Plot',
    meaning:
      'The backbone of a story, with events woven by cause and effect rather than by time order alone.',
  },
  {
    id: 'literature-exposition',
    domain: 'literature',
    term: 'Exposition',
    original: 'Exposition',
    meaning:
      'The first stage of a story, where characters and setting are introduced and the thread of events appears.',
  },
  {
    id: 'literature-conflict',
    domain: 'literature',
    term: 'Conflict',
    original: 'Conflict',
    meaning:
      "Opposing forces between characters, between a character and society, or within a character's mind. It drives the story.",
  },
  {
    id: 'literature-climax',
    domain: 'literature',
    term: 'Climax',
    original: 'Climax',
    meaning: 'The moment conflict is at its highest and the direction of events is decided.',
  },
  {
    id: 'literature-denouement',
    domain: 'literature',
    term: 'Denouement',
    original: 'Denouement',
    meaning:
      "The final stage after the climax, where tangled events are resolved and characters' fates are settled.",
  },
  {
    id: 'literature-foreshadowing',
    domain: 'literature',
    term: 'Foreshadowing',
    original: 'Foreshadowing',
    meaning: 'A technique of hinting early at events that will happen later.',
  },
  {
    id: 'literature-flashback',
    domain: 'literature',
    term: 'Flashback',
    original: 'Flashback',
    meaning: 'A technique that pauses the present story to show something from the past.',
  },
  {
    id: 'literature-frame-story',
    domain: 'literature',
    term: 'Frame Story',
    original: 'Frame Story',
    meaning:
      'A structure that places another story inside an outer story. The name compares it to a picture set in a frame.',
  },
  {
    id: 'literature-in-medias-res',
    domain: 'literature',
    term: 'In Medias Res',
    original: 'In Medias Res',
    meaning:
      'A way of starting the story in the middle of the action rather than at the beginning. What came before is revealed later.',
  },
  {
    id: 'literature-picaresque',
    domain: 'literature',
    term: 'Picaresque Structure',
    original: 'Picaresque Structure',
    meaning:
      'A structure that links, one after another, the separate episodes of a wandering protagonist.',
  },
  {
    id: 'literature-open-ending',
    domain: 'literature',
    term: 'Open Ending',
    original: 'Open Ending',
    meaning:
      "An ending that does not settle how the story ends and leaves it to the reader's interpretation.",
  },
  {
    id: 'literature-protagonist',
    domain: 'literature',
    term: 'Protagonist',
    original: 'Protagonist',
    meaning: 'The character at the center of the story who drives events.',
  },
  {
    id: 'literature-antagonist',
    domain: 'literature',
    term: 'Antagonist',
    original: 'Antagonist',
    meaning: 'The character or force that opposes the protagonist and creates conflict.',
  },
  // Literature — Rhetoric: ways of embellishing expression
  {
    id: 'literature-simile',
    domain: 'literature',
    term: 'Simile',
    original: 'Simile',
    meaning: 'An expression that compares two things directly using "like" or "as".',
  },
  {
    id: 'literature-metaphor',
    domain: 'literature',
    term: 'Metaphor',
    original: 'Metaphor',
    meaning:
      'An expression that replaces one thing directly with another, as in "A is B", without a word of comparison.',
  },
  {
    id: 'literature-personification',
    domain: 'literature',
    term: 'Personification',
    original: 'Personification',
    meaning:
      'An expression that portrays something not human as thinking and acting like a person.',
  },
  {
    id: 'literature-symbol',
    domain: 'literature',
    term: 'Symbol',
    original: 'Symbol',
    meaning: 'A concrete thing that stands in for an invisible idea or feeling.',
  },
  {
    id: 'literature-irony',
    domain: 'literature',
    term: 'Irony',
    original: 'Irony',
    meaning:
      'An expression that says the opposite of what is meant to convey the meaning more strongly.',
  },
  {
    id: 'literature-paradox',
    domain: 'literature',
    term: 'Paradox',
    original: 'Paradox',
    meaning: 'An expression that seems self-contradictory on the surface but holds a truth.',
  },
  {
    id: 'literature-hyperbole',
    domain: 'literature',
    term: 'Hyperbole',
    original: 'Hyperbole',
    meaning: 'Exaggerating far beyond or below reality to stress a feeling.',
  },
  {
    id: 'literature-parallelism',
    domain: 'literature',
    term: 'Parallelism',
    original: 'Parallelism',
    meaning:
      'An expression that sets phrases of similar structure side by side to create rhythm and contrast.',
  },
  {
    id: 'literature-repetition',
    domain: 'literature',
    term: 'Repetition',
    original: 'Repetition',
    meaning:
      'An expression that repeats the same word or phrase to stress a meaning and create rhythm.',
  },
  {
    id: 'literature-inversion',
    domain: 'literature',
    term: 'Inversion',
    original: 'Inversion',
    meaning:
      'An expression that changes the normal word order to put the part to be stressed first.',
  },
  {
    id: 'literature-rhetorical-question',
    domain: 'literature',
    term: 'Rhetorical Question',
    original: 'Rhetorical Question',
    meaning:
      'An expression that deliberately poses a question whose answer is already settled, for emphasis.',
  },
  {
    id: 'literature-allusion',
    domain: 'literature',
    term: 'Allusion',
    original: 'Allusion',
    meaning:
      'An expression that draws on a well-known work, person, or event to widen its meaning.',
  },
  // Movies — Shooting: shot size, angle, and camera movement
  {
    id: 'movie-long-shot',
    domain: 'movie',
    term: 'Long Shot',
    original: 'Long Shot',
    meaning:
      'A shot that captures a character from far away so the whole body and the surrounding space are visible. It tells you where the character is.',
  },
  {
    id: 'movie-medium-shot',
    domain: 'movie',
    term: 'Medium Shot',
    original: 'Medium Shot',
    meaning:
      'A shot that frames a character from about the waist up. Expression and gesture both show, so it is common in dialogue scenes.',
  },
  {
    id: 'movie-close-up',
    domain: 'movie',
    term: 'Close-Up',
    original: 'Close-Up',
    meaning:
      'A shot that fills the frame with a face or a single object. It stresses emotion or an important clue.',
  },
  {
    id: 'movie-extreme-close-up',
    domain: 'movie',
    term: 'Extreme Close-Up',
    original: 'Extreme Close-Up',
    meaning:
      'A shot that fills the frame with only a very small part, such as an eye, lips, or a finger.',
  },
  {
    id: 'movie-over-the-shoulder',
    domain: 'movie',
    term: 'Over-the-Shoulder Shot',
    original: 'Over-the-Shoulder Shot',
    meaning:
      "A shot of one character taken over another's shoulder. It conveys the two facing each other.",
  },
  {
    id: 'movie-pov-shot',
    domain: 'movie',
    term: 'Point-of-View Shot',
    original: 'Point-of-View Shot',
    meaning:
      "A shot that shows what a character sees from that character's eye level and direction.",
  },
  {
    id: 'movie-high-angle',
    domain: 'movie',
    term: 'High Angle',
    original: 'High Angle',
    meaning:
      'An angle shot with the camera looking down from above. The character looks small and weak.',
  },
  {
    id: 'movie-low-angle',
    domain: 'movie',
    term: 'Low Angle',
    original: 'Low Angle',
    meaning:
      'An angle shot with the camera looking up from below. The character looks big and imposing.',
  },
  {
    id: 'movie-pan',
    domain: 'movie',
    term: 'Pan',
    original: 'Pan',
    meaning: 'A camera movement that turns the camera head left and right from a fixed position.',
  },
  {
    id: 'movie-tilt',
    domain: 'movie',
    term: 'Tilt',
    original: 'Tilt',
    meaning: 'A camera movement that tilts the camera head up and down from a fixed position.',
  },
  {
    id: 'movie-tracking-shot',
    domain: 'movie',
    term: 'Tracking Shot',
    original: 'Tracking Shot',
    meaning: 'A shot in which the camera moves on rails or a cart to follow a character.',
  },
  {
    id: 'movie-handheld',
    domain: 'movie',
    term: 'Handheld',
    original: 'Handheld',
    meaning:
      'A way of shooting with the camera held in the hands or on the shoulder. The shaking image gives a sense of presence and unease.',
  },
  {
    id: 'movie-depth-of-field',
    domain: 'movie',
    term: 'Depth of Field',
    original: 'Depth of Field',
    meaning:
      'The range in front of and behind the focus point that looks sharp. With shallow depth, the background blurs and the character stands out.',
  },
  // Movies — Editing: ways of joining scenes
  {
    id: 'movie-montage',
    domain: 'movie',
    term: 'Montage',
    original: 'Montage',
    meaning: 'An editing technique that joins several scenes to create a new meaning.',
  },
  {
    id: 'movie-cut',
    domain: 'movie',
    term: 'Cut',
    original: 'Cut',
    meaning:
      'The seam that jumps straight from one shot to another. It is the most basic unit of editing.',
  },
  {
    id: 'movie-long-take',
    domain: 'movie',
    term: 'Long Take',
    original: 'Long Take',
    meaning:
      'A single shot that runs on for a long time without a cut. It gives the tension of time passing as in real life.',
  },
  {
    id: 'movie-jump-cut',
    domain: 'movie',
    term: 'Jump Cut',
    original: 'Jump Cut',
    meaning: 'An edit that removes the middle of a shot of the same subject so time seems to jump.',
  },
  {
    id: 'movie-dissolve',
    domain: 'movie',
    term: 'Dissolve',
    original: 'Dissolve',
    meaning:
      'A transition in which the next shot appears overlapped as the previous one slowly fades away.',
  },
  {
    id: 'movie-fade',
    domain: 'movie',
    term: 'Fade In / Fade Out',
    original: 'Fade In / Fade Out',
    meaning:
      'A transition in which the image slowly brightens from black, or slowly darkens into black.',
  },
  {
    id: 'movie-cross-cutting',
    domain: 'movie',
    term: 'Cross-Cutting',
    original: 'Cross-Cutting',
    meaning:
      'An edit that alternates between events happening at the same time in different places. It is used to build tension.',
  },
  {
    id: 'movie-match-cut',
    domain: 'movie',
    term: 'Match Cut',
    original: 'Match Cut',
    meaning:
      'An edit that joins two shots with similar shapes or movement to change scenes smoothly.',
  },
  {
    id: 'movie-shot-reverse-shot',
    domain: 'movie',
    term: 'Shot / Reverse Shot',
    original: 'Shot / Reverse Shot',
    meaning:
      'An edit that alternates between two characters in conversation, shot from opposite directions.',
  },
  {
    id: 'movie-180-degree-rule',
    domain: 'movie',
    term: '180-Degree Rule',
    original: '180-Degree Rule',
    meaning:
      'A rule of filming from one side of an imaginary line joining two characters. Keeping it prevents confusion about who is on which side.',
  },
  {
    id: 'movie-insert',
    domain: 'movie',
    term: 'Insert Shot',
    original: 'Insert Shot',
    meaning:
      'A short shot inserted mid-scene that shows a detail large, such as a clock, a letter, or a hand.',
  },
  {
    id: 'movie-flashback',
    domain: 'movie',
    term: 'Flashback',
    original: 'Flashback',
    meaning: 'An edit that places past scenes among present ones to show what happened earlier.',
  },
  // Movies — Direction and story
  {
    id: 'movie-mise-en-scene',
    domain: 'movie',
    term: 'Mise-en-scène',
    original: 'Mise-en-scène',
    meaning:
      'The arrangement of everything seen within a frame, such as actors, lighting, and props.',
  },
  {
    id: 'movie-screenplay',
    domain: 'movie',
    term: 'Screenplay',
    original: 'Screenplay',
    meaning:
      "A script that sets down scenes, dialogue, and characters' actions in a form suited to filming.",
  },
  {
    id: 'movie-storyboard',
    domain: 'movie',
    term: 'Storyboard',
    original: 'Storyboard',
    meaning: 'Drawings made before shooting that show the framing and movement of each scene.',
  },
  {
    id: 'movie-scene',
    domain: 'movie',
    term: 'Scene',
    original: 'Scene',
    meaning: 'One scene that continues in the same place and time.',
  },
  {
    id: 'movie-sequence',
    domain: 'movie',
    term: 'Sequence',
    original: 'Sequence',
    meaning:
      'A unit in which several scenes together form one event or flow. It can be compared to a chapter in a novel.',
  },
  {
    id: 'movie-blocking',
    domain: 'movie',
    term: 'Blocking',
    original: 'Blocking',
    meaning: 'Deciding where actors stand and how they move in a scene, in step with the camera.',
  },
  {
    id: 'movie-location',
    domain: 'movie',
    term: 'Location',
    original: 'Location',
    meaning:
      'Shooting in a real street, building, or natural setting rather than on a set, or the place itself.',
  },
  {
    id: 'movie-set',
    domain: 'movie',
    term: 'Set',
    original: 'Set',
    meaning: 'An artificial space built in a studio or outdoors for filming.',
  },
  {
    id: 'movie-macguffin',
    domain: 'movie',
    term: 'MacGuffin',
    original: 'MacGuffin',
    meaning:
      'An object or goal that the characters chase and that drives the story, but that is not itself important.',
  },
  {
    id: 'movie-homage',
    domain: 'movie',
    term: 'Homage',
    original: 'Homage',
    meaning:
      'Deliberately imitating a scene or composition from an admired director or work as a tribute.',
  },
  {
    id: 'movie-cameo',
    domain: 'movie',
    term: 'Cameo',
    original: 'Cameo',
    meaning: 'A very brief appearance by a famous person.',
  },
  {
    id: 'movie-film-noir',
    domain: 'movie',
    term: 'Film Noir',
    original: 'Film Noir',
    meaning:
      'A trend from American crime films of the 1940s and 50s. It features dark lighting, cynical heroes, and urban crime.',
  },
  {
    id: 'movie-documentary',
    domain: 'movie',
    term: 'Documentary',
    original: 'Documentary',
    meaning: 'A film that records and shows real people and events.',
  },
  // Movies — Sound and production
  {
    id: 'movie-diegetic-sound',
    domain: 'movie',
    term: 'Diegetic Sound',
    original: 'Diegetic Sound',
    meaning:
      'Sound from within the story world that the characters can also hear, such as dialogue or a radio.',
  },
  {
    id: 'movie-non-diegetic-sound',
    domain: 'movie',
    term: 'Non-Diegetic Sound',
    original: 'Non-Diegetic Sound',
    meaning:
      'Sound only the audience hears and the characters do not, such as background music or narration.',
  },
  {
    id: 'movie-foley',
    domain: 'movie',
    term: 'Foley',
    original: 'Foley',
    meaning:
      'Recording everyday sound effects such as footsteps and rustling clothes separately in a studio to match the picture.',
  },
  {
    id: 'movie-adr',
    domain: 'movie',
    term: 'ADR',
    original: 'ADR',
    meaning:
      'Re-recording dialogue in a studio after filming, with the actor matching the picture.',
  },
  {
    id: 'movie-score',
    domain: 'movie',
    term: 'Film Score',
    original: 'Film Score',
    meaning: 'Music newly composed for the film to support the mood of its scenes.',
  },
  {
    id: 'movie-pre-production',
    domain: 'movie',
    term: 'Pre-Production',
    original: 'Pre-Production',
    meaning:
      'The stage before filming in which the script, cast, locations, and schedule are prepared.',
  },
  {
    id: 'movie-post-production',
    domain: 'movie',
    term: 'Post-Production',
    original: 'Post-Production',
    meaning:
      'The stage after filming in which editing, sound, color correction, and effects complete the film.',
  },
  {
    id: 'movie-color-grading',
    domain: 'movie',
    term: 'Color Grading',
    original: 'Color Grading',
    meaning:
      'Adjusting the color and brightness of the footage to unify the mood of the whole film.',
  },
  {
    id: 'movie-vfx',
    domain: 'movie',
    term: 'VFX',
    original: 'VFX',
    meaning:
      'Making scenes that are hard to shoot for real with computer graphics, or adding them to the footage.',
  },
  {
    id: 'movie-directors-cut',
    domain: 'movie',
    term: "Director's Cut",
    original: "Director's Cut",
    meaning:
      'A version re-edited as the director originally intended, unlike the theatrical release.',
  },
  {
    id: 'movie-end-credits',
    domain: 'movie',
    term: 'End Credits',
    original: 'End Credits',
    meaning: 'The part after the film where the names of the people who made it roll by.',
  },
  {
    id: 'movie-post-credits-scene',
    domain: 'movie',
    term: 'Post-Credits Scene',
    original: 'Post-Credits Scene',
    meaning:
      'A short scene added in the middle of or after the end credits. It often teases the next installment.',
  },
  // Opera — Voices: kinds of voices
  {
    id: 'opera-soprano',
    domain: 'opera',
    term: 'Soprano',
    original: 'Soprano',
    meaning: 'The highest female voice. It often takes the heroine in opera.',
  },
  {
    id: 'opera-mezzo-soprano',
    domain: 'opera',
    term: 'Mezzo-Soprano',
    original: 'Mezzo-Soprano',
    meaning:
      'A female voice a little lower than the soprano. It also takes roles such as mothers, seductresses, and boys.',
  },
  {
    id: 'opera-contralto',
    domain: 'opera',
    term: 'Contralto',
    original: 'Contralto',
    meaning: 'The lowest female voice. It has a dark, deep sound and is rare.',
  },
  {
    id: 'opera-countertenor',
    domain: 'opera',
    term: 'Countertenor',
    original: 'Countertenor',
    meaning: 'A male singer who uses falsetto to sing in the female alto or mezzo-soprano range.',
  },
  {
    id: 'opera-tenor',
    domain: 'opera',
    term: 'Tenor',
    original: 'Tenor',
    meaning: 'The highest male voice. It often takes the hero in opera.',
  },
  {
    id: 'opera-baritone',
    domain: 'opera',
    term: 'Baritone',
    original: 'Baritone',
    meaning: 'A male voice between tenor and bass. It often takes villains, fathers, and friends.',
  },
  {
    id: 'opera-bass',
    domain: 'opera',
    term: 'Bass',
    original: 'Bass',
    meaning:
      'The lowest male voice. It often takes weighty roles such as kings, priests, and old men.',
  },
  {
    id: 'opera-coloratura',
    domain: 'opera',
    term: 'Coloratura',
    original: 'Coloratura',
    meaning:
      'A style of singing rapid notes and high pitches with brilliant ornament, or a singer good at it.',
  },
  {
    id: 'opera-lyric',
    domain: 'opera',
    term: 'Lirico / Lyric',
    original: 'Lirico / Lyric',
    meaning: 'A voice type that is clear and soft and suits lyrical songs.',
  },
  {
    id: 'opera-dramatic',
    domain: 'opera',
    term: 'Drammatico / Dramatic',
    original: 'Drammatico / Dramatic',
    meaning:
      'A voice type that is big and powerful enough to cut through a large orchestra. It suits the intense roles of tragedy.',
  },
  {
    id: 'opera-prima-donna',
    domain: 'opera',
    term: 'Prima Donna',
    original: 'Prima Donna',
    meaning: 'The most important female singer, who takes the heroine in an opera.',
  },
  {
    id: 'opera-trouser-role',
    domain: 'opera',
    term: 'Trouser Role',
    original: 'Trouser Role',
    meaning:
      'A role in which a female singer, usually a mezzo-soprano, dresses as a man and plays a boy or young man.',
  },
  // Opera — Forms: the parts of a work
  {
    id: 'opera-aria',
    domain: 'opera',
    term: 'Aria',
    original: 'Aria',
    meaning: 'A solo song in which a character expresses their feelings.',
  },
  {
    id: 'opera-recitative',
    domain: 'opera',
    term: 'Recitativo',
    original: 'Recitativo',
    meaning: 'A part that carries the plot forward by singing in a speech-like manner.',
  },
  {
    id: 'opera-overture',
    domain: 'opera',
    term: 'Overture',
    original: 'Overture',
    meaning:
      'A piece played by the orchestra alone before the curtain rises. It can preview melodies from the work.',
  },
  {
    id: 'opera-prelude',
    domain: 'opera',
    term: 'Prelude',
    original: 'Prelude',
    meaning:
      'A short orchestral piece played before the curtain opens. It is shorter than an overture and often leads straight into the next scene.',
  },
  {
    id: 'opera-intermezzo',
    domain: 'opera',
    term: 'Intermezzo',
    original: 'Intermezzo',
    meaning: 'A piece the orchestra plays between acts or scenes.',
  },
  {
    id: 'opera-duet',
    domain: 'opera',
    term: 'Duet',
    original: 'Duet',
    meaning:
      'A song sung by two people together. It is common in love declarations and quarrel scenes.',
  },
  {
    id: 'opera-ensemble',
    domain: 'opera',
    term: 'Ensemble',
    original: 'Ensemble',
    meaning:
      'A part sung by three or more characters together. Each may sing a different emotion at the same time.',
  },
  {
    id: 'opera-chorus',
    domain: 'opera',
    term: 'Chorus',
    original: 'Chorus',
    meaning:
      'A song sung together by many characters such as a crowd or villagers, or the singers who perform it.',
  },
  {
    id: 'opera-cabaletta',
    domain: 'opera',
    term: 'Cabaletta',
    original: 'Cabaletta',
    meaning:
      'A fast, brilliant closing section that follows a slow song. It is common in 19th-century Italian opera.',
  },
  {
    id: 'opera-da-capo-aria',
    domain: 'opera',
    term: 'Da Capo Aria',
    original: 'Da Capo Aria',
    meaning:
      'An aria in the order first part, contrasting part, first part again. The singer adds ornaments to the returning first part. It is common in Baroque opera.',
  },
  {
    id: 'opera-leitmotif',
    domain: 'opera',
    term: 'Leitmotif',
    original: 'Leitmotif',
    meaning:
      'A short melody that stands for a particular character, object, or idea and recurs each time it appears. Wagner used it often.',
  },
  {
    id: 'opera-libretto',
    domain: 'opera',
    term: 'Libretto',
    original: 'Libretto',
    meaning: 'The words and script of an opera.',
  },
  {
    id: 'opera-act',
    domain: 'opera',
    term: 'Act',
    original: 'Act',
    meaning: 'A major division of an opera. When an act changes, the stage changes or time passes.',
  },
  // Opera — Stage and performance
  {
    id: 'opera-opera-house',
    domain: 'opera',
    term: 'Opera House',
    original: 'Opera House',
    meaning:
      'A theater built to perform opera, with a stage, an orchestra pit, and several tiers of seats.',
  },
  {
    id: 'opera-orchestra-pit',
    domain: 'opera',
    term: 'Orchestra Pit',
    original: 'Orchestra Pit',
    meaning: 'The sunken space in front of the stage, below floor level, where the orchestra sits.',
  },
  {
    id: 'opera-conductor',
    domain: 'opera',
    term: 'Conductor',
    original: 'Conductor',
    meaning:
      'The person who leads the whole musical performance, matching the tempo and dynamics of the orchestra and singers. Honored with the title maestro.',
  },
  {
    id: 'opera-prompter',
    domain: 'opera',
    term: 'Prompter',
    original: 'Prompter',
    meaning:
      'A person hidden in a small box at the front of the stage who cues singers with words and entrances.',
  },
  {
    id: 'opera-surtitles',
    domain: 'opera',
    term: 'Surtitles',
    original: 'Surtitles',
    meaning: 'A translation of the lyrics shown on a screen above or beside the stage.',
  },
  {
    id: 'opera-intermission',
    domain: 'opera',
    term: 'Intermission',
    original: 'Intermission',
    meaning: 'The break between acts.',
  },
  {
    id: 'opera-bravo',
    domain: 'opera',
    term: 'Bravo / Brava / Bravi',
    original: 'Bravo / Brava / Bravi',
    meaning:
      'A shout when a performance was good: bravo for a man, brava for a woman, and bravi for several.',
  },
  {
    id: 'opera-regietheater',
    domain: 'opera',
    term: 'Regietheater',
    original: 'Regietheater',
    meaning:
      'A staging in which the director freely reinterprets the work, for example by changing its period or setting. It began in Germany.',
  },
  {
    id: 'opera-repertoire',
    domain: 'opera',
    term: 'Repertoire',
    original: 'Repertoire',
    meaning: 'The list of works a theater or singer has ready to perform.',
  },
  {
    id: 'opera-production',
    domain: 'opera',
    term: 'Production',
    original: 'Production',
    meaning:
      'A staging of a work with a particular direction, sets, and costumes. The same work looks different in each production.',
  },
  {
    id: 'opera-concert-performance',
    domain: 'opera',
    term: 'Concert Performance',
    original: 'Concert Performance',
    meaning:
      'A way of performing in which singers and orchestra perform only the music, without sets or acting.',
  },
  {
    id: 'opera-cover',
    domain: 'opera',
    term: 'Cover',
    original: 'Cover',
    meaning: 'A singer who learns a role in advance to step in when the lead singer cannot appear.',
  },
  // Opera — Genres and movements
  {
    id: 'opera-opera-seria',
    domain: 'opera',
    term: 'Opera Seria',
    original: 'Opera Seria',
    meaning:
      'Serious Italian opera about heroes from myth or history. It was popular in the 18th century and centers on arias.',
  },
  {
    id: 'opera-opera-buffa',
    domain: 'opera',
    term: 'Opera Buffa',
    original: 'Opera Buffa',
    meaning: 'Italian comic opera that depicts the lives of ordinary people with humor.',
  },
  {
    id: 'opera-bel-canto',
    domain: 'opera',
    term: 'Bel Canto',
    original: 'Bel Canto',
    meaning:
      'Meaning "beautiful singing". A singing style that puts smooth, brilliant vocal skill first, and a term for Italian opera of the early 19th century.',
  },
  {
    id: 'opera-verismo',
    domain: 'opera',
    term: 'Verismo',
    original: 'Verismo',
    meaning:
      'Realist opera from late 19th-century Italy that depicts the intense love and violence of ordinary people.',
  },
  {
    id: 'opera-grand-opera',
    domain: 'opera',
    term: 'Grand Opéra',
    original: 'Grand Opéra',
    meaning:
      'Large-scale opera popular in 19th-century Paris, with historical stories, lavish staging, and ballet.',
  },
  {
    id: 'opera-singspiel',
    domain: 'opera',
    term: 'Singspiel',
    original: 'Singspiel',
    meaning: 'German-language opera in which dialogue is spoken between the songs.',
  },
  {
    id: 'opera-music-drama',
    domain: 'opera',
    term: 'Musikdrama',
    original: 'Musikdrama',
    meaning:
      "Wagner's opera form, in which arias and recitatives are not separated and the music flows without a break.",
  },
  {
    id: 'opera-gesamtkunstwerk',
    domain: 'opera',
    term: 'Gesamtkunstwerk',
    original: 'Gesamtkunstwerk',
    meaning:
      'The idea of an art that unites music, poetry, acting, and visual art. Wagner put it forward as the ideal of opera.',
  },
  {
    id: 'opera-operetta',
    domain: 'opera',
    term: 'Operetta',
    original: 'Operetta',
    meaning:
      'A light comic opera that mixes dialogue, song, and dance. It is one of the roots of the musical.',
  },
  {
    id: 'opera-baroque-opera',
    domain: 'opera',
    term: 'Baroque Opera',
    original: 'Baroque Opera',
    meaning:
      'Opera made from the early 17th to the mid-18th century. It often treats myth or ancient history and features highly ornamented singing.',
  },
  {
    id: 'opera-castrato',
    domain: 'opera',
    term: 'Castrato',
    original: 'Castrato',
    meaning:
      'A male singer castrated before puberty to keep a high voice. A star of Baroque opera, now extinct. Countertenors or mezzo-sopranos sing those roles.',
  },
  {
    id: 'opera-chamber-opera',
    domain: 'opera',
    term: 'Chamber Opera',
    original: 'Chamber Opera',
    meaning: 'A small-scale opera performed with a few singers and a small ensemble.',
  },
  {
    id: 'opera-zarzuela',
    domain: 'opera',
    term: 'Zarzuela',
    original: 'Zarzuela',
    meaning: 'A Spanish musical drama that mixes dialogue, song, and dance.',
  },
  // Musicals — Numbers: kinds and uses of songs
  {
    id: 'musical-number',
    domain: 'musical',
    term: 'Number',
    original: 'Number',
    meaning: 'A term for each individual song in a musical.',
  },
  {
    id: 'musical-opening-number',
    domain: 'musical',
    term: 'Opening Number',
    original: 'Opening Number',
    meaning:
      'The song at the start of the show. It tells the audience the mood and setting of the work.',
  },
  {
    id: 'musical-i-want-song',
    domain: 'musical',
    term: 'I Want Song',
    original: 'I Want Song',
    meaning:
      "A number early on in which the protagonist sings about what they want. It tells the audience the story's goal.",
  },
  {
    id: 'musical-showstopper',
    domain: 'musical',
    term: 'Showstopper',
    original: 'Showstopper',
    meaning: 'A number that gets such long applause that the show briefly stops.',
  },
  {
    id: 'musical-eleven-oclock-number',
    domain: 'musical',
    term: "Eleven O'Clock Number",
    original: "Eleven O'Clock Number",
    meaning:
      'A big number the protagonist sings near the end of Act 2. The name comes from the days when shows began around 8:30 p.m. and this number came around 11 p.m.',
  },
  {
    id: 'musical-reprise',
    domain: 'musical',
    term: 'Reprise',
    original: 'Reprise',
    meaning:
      'Singing an earlier number again with changed words or mood. It shows how a character has changed.',
  },
  {
    id: 'musical-duet',
    domain: 'musical',
    term: 'Duet',
    original: 'Duet',
    meaning: 'A number sung by two people together.',
  },
  {
    id: 'musical-finale',
    domain: 'musical',
    term: 'Finale',
    original: 'Finale',
    meaning: 'The number that closes an act or the whole show. Many actors often sing it together.',
  },
  {
    id: 'musical-overture',
    domain: 'musical',
    term: 'Overture',
    original: 'Overture',
    meaning:
      'A piece the band plays before the show that weaves together melodies from the numbers.',
  },
  {
    id: 'musical-entracte',
    domain: 'musical',
    term: "Entr'acte",
    original: "Entr'acte",
    meaning: 'A piece the band plays when Act 2 begins after the intermission.',
  },
  {
    id: 'musical-underscore',
    domain: 'musical',
    term: 'Underscore',
    original: 'Underscore',
    meaning: 'Background music laid under dialogue or a scene.',
  },
  {
    id: 'musical-belting',
    domain: 'musical',
    term: 'Belting',
    original: 'Belting',
    meaning:
      'A way of singing that carries the chest voice up to high notes, loud and strong. It is widely used in musicals.',
  },
  {
    id: 'musical-sung-through',
    domain: 'musical',
    term: 'Sung-Through',
    original: 'Sung-Through',
    meaning: 'A way of carrying nearly every scene in song, with no spoken dialogue.',
  },
  // Musicals — Stage: space and equipment
  {
    id: 'musical-proscenium',
    domain: 'musical',
    term: 'Proscenium',
    original: 'Proscenium',
    meaning:
      'The frame that surrounds the front of the stage like a picture frame. The audience watches as if looking in through it.',
  },
  {
    id: 'musical-thrust-stage',
    domain: 'musical',
    term: 'Thrust Stage',
    original: 'Thrust Stage',
    meaning: 'A stage that juts out toward the seats so the audience looks on from three sides.',
  },
  {
    id: 'musical-turntable',
    domain: 'musical',
    term: 'Turntable',
    original: 'Turntable',
    meaning: 'A stage device whose floor rotates to change scenes or move actors.',
  },
  {
    id: 'musical-fly-system',
    domain: 'musical',
    term: 'Fly System',
    original: 'Fly System',
    meaning:
      'A system above the stage for hanging scenery and equipment and raising and lowering them.',
  },
  {
    id: 'musical-blackout',
    domain: 'musical',
    term: 'Blackout',
    original: 'Blackout',
    meaning:
      'Turning off all the stage lights to make it completely dark. It is used to end or change a scene.',
  },
  {
    id: 'musical-follow-spot',
    domain: 'musical',
    term: 'Follow Spot',
    original: 'Follow Spot',
    meaning: 'A strong light that follows a moving actor.',
  },
  {
    id: 'musical-upstage-downstage',
    domain: 'musical',
    term: 'Upstage / Downstage',
    original: 'Upstage / Downstage',
    meaning:
      'The back of the stage is upstage and the front near the seats is downstage. The terms come from old stages that rose toward the back.',
  },
  {
    id: 'musical-stage-manager',
    domain: 'musical',
    term: 'Stage Manager',
    original: 'Stage Manager',
    meaning:
      "The person who runs the whole show during a performance by signaling lighting, sound, equipment, and actors' entrances.",
  },
  {
    id: 'musical-cue',
    domain: 'musical',
    term: 'Cue',
    original: 'Cue',
    meaning: "A signal for a change in lighting, sound, or equipment, or for an actor's entrance.",
  },
  {
    id: 'musical-fourth-wall',
    domain: 'musical',
    term: 'Fourth Wall',
    original: 'Fourth Wall',
    meaning:
      'The invisible wall thought to lie between stage and audience. An actor speaking directly to the audience is said to break it.',
  },
  {
    id: 'musical-wireless-mic',
    domain: 'musical',
    term: 'Wireless Microphone',
    original: 'Wireless Microphone',
    meaning:
      "A small wireless microphone stuck to an actor's forehead or cheek that carries the voice without using the hands.",
  },
  {
    id: 'musical-scene-change',
    domain: 'musical',
    term: 'Scene Change',
    original: 'Scene Change',
    meaning: 'Moving sets and props when the scene changes to create a new space.',
  },
  // Musicals — Roles and viewing
  {
    id: 'musical-ensemble',
    domain: 'musical',
    term: 'Ensemble',
    original: 'Ensemble',
    meaning:
      'The roles of the many actors, apart from the leads, who fill the stage with song and dance together.',
  },
  {
    id: 'musical-understudy',
    domain: 'musical',
    term: 'Understudy',
    original: 'Understudy',
    meaning:
      'An actor who learns a major role in addition to their own and steps in when that actor cannot appear. Normally they perform in another role.',
  },
  {
    id: 'musical-swing',
    domain: 'musical',
    term: 'Swing',
    original: 'Swing',
    meaning:
      'An actor who waits off stage, having learned all the ensemble roles, to fill any vacancy.',
  },
  {
    id: 'musical-multi-casting',
    domain: 'musical',
    term: 'Multi-Casting',
    original: 'Multi-Casting',
    meaning:
      'A way of having several actors take turns in one role. The same show can look different with different actor combinations.',
  },
  {
    id: 'musical-casting-board',
    domain: 'musical',
    term: 'Casting Board',
    original: 'Casting Board',
    meaning: 'A board posted in the theater with the names of the actors appearing that day.',
  },
  {
    id: 'musical-preview',
    domain: 'musical',
    term: 'Preview',
    original: 'Preview',
    meaning:
      'Performances before the official opening, in which the show is refined while watching audience reaction. Tickets are often cheaper.',
  },
  {
    id: 'musical-press-call',
    domain: 'musical',
    term: 'Press Call',
    original: 'Press Call',
    meaning: 'An event around opening where key scenes are shown to reporters in advance.',
  },
  {
    id: 'musical-curtain-call',
    domain: 'musical',
    term: 'Curtain Call',
    original: 'Curtain Call',
    meaning: 'The part after the show when the actors come onstage to greet the audience.',
  },
  {
    id: 'musical-special-curtain-call',
    domain: 'musical',
    term: 'Special Curtain Call',
    original: 'Special Curtain Call',
    meaning:
      'An extra stage after the curtain call, such as singing one number again. Photography is sometimes allowed.',
  },
  {
    id: 'musical-revolving-door',
    domain: 'musical',
    term: 'Repeat Viewing',
    original: 'Repeat Viewing',
    meaning:
      'Watching the same show many times. The name suggests going in and out like a revolving door at a theater.',
  },
  {
    id: 'musical-closing-performance',
    domain: 'musical',
    term: 'Closing Performance',
    original: 'Closing Performance',
    meaning:
      'The last performance of a season, or the last performance an actor gives in that season.',
  },
  {
    id: 'musical-stage-door',
    domain: 'musical',
    term: 'Stage Door',
    original: 'Stage Door',
    meaning: 'Waiting for an actor to leave the theater after a show in order to meet them.',
  },
  // Musicals — Production and genres
  {
    id: 'musical-broadway',
    domain: 'musical',
    term: 'Broadway',
    original: 'Broadway',
    meaning:
      'The theater district in Manhattan, New York, USA. With its many large theaters, it is considered the center of commercial musicals.',
  },
  {
    id: 'musical-west-end',
    domain: 'musical',
    term: 'West End',
    original: 'West End',
    meaning:
      'The theater district in London, UK. Together with Broadway, it is one of the two major centers of musicals.',
  },
  {
    id: 'musical-daehangno',
    domain: 'musical',
    term: 'Daehangno',
    original: 'Daehangno',
    meaning:
      'A theater district in Jongno-gu, Seoul. With many small theaters, it has a lively scene of original musicals and small-theater shows.',
  },
  {
    id: 'musical-license-musical',
    domain: 'musical',
    term: 'Licensed Musical',
    original: 'Licensed Musical',
    meaning:
      'A musical for which the rights to a foreign work are bought and the show is staged in Korean.',
  },
  {
    id: 'musical-original-musical',
    domain: 'musical',
    term: 'Original Musical',
    original: 'Original Musical',
    meaning: 'A musical newly created in Korea rather than brought in from abroad.',
  },
  {
    id: 'musical-jukebox-musical',
    domain: 'musical',
    term: 'Jukebox Musical',
    original: 'Jukebox Musical',
    meaning:
      'A musical whose story is built by stringing together already well-known popular songs.',
  },
  {
    id: 'musical-book-musical',
    domain: 'musical',
    term: 'Book Musical',
    original: 'Book Musical',
    meaning:
      'A musical centered on a scripted story, with songs and dance carrying that story along. The script is called the book.',
  },
  {
    id: 'musical-concept-musical',
    domain: 'musical',
    term: 'Concept Musical',
    original: 'Concept Musical',
    meaning:
      'A musical that strings scenes together around a single theme or idea rather than a plot.',
  },
  {
    id: 'musical-revival',
    domain: 'musical',
    term: 'Revival',
    original: 'Revival',
    meaning: 'Staging a work that has finished its run again in a new production.',
  },
  {
    id: 'musical-tour',
    domain: 'musical',
    term: 'Touring Production',
    original: 'Touring Production',
    meaning: 'A show that does not stay in one theater but travels among many cities.',
  },
  {
    id: 'musical-tryout',
    domain: 'musical',
    term: 'Tryout',
    original: 'Tryout',
    meaning:
      'A show first staged in a small venue or another city before the main run, to refine the work.',
  },
  {
    id: 'musical-workshop',
    domain: 'musical',
    term: 'Workshop',
    original: 'Workshop',
    meaning:
      'A development-stage showing, mostly of script and songs without sets, to see audience reaction.',
  },
  {
    id: 'musical-tony-awards',
    domain: 'musical',
    term: 'Tony Awards',
    original: 'Tony Awards',
    meaning: 'The leading American performing arts awards, given for Broadway plays and musicals.',
  },
];
