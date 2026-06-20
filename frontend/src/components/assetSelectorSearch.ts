export interface SearchableAsset {
  symbol: string;
  name: string;
}

const EXACT_SYMBOL_SCORE = 100;
const SYMBOL_PREFIX_SCORE = 80;
const SYMBOL_SUBSTRING_SCORE = 60;
const NAME_PREFIX_SCORE = 40;
const NAME_TOKEN_PREFIX_SCORE = 35;
const NAME_SUBSTRING_SCORE = 20;
const SYMBOL_TYPO_SCORE = 55;
const NAME_TYPO_SCORE = 18;

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, '');
}

function tokenize(value: string): string[] {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function editDistanceWithin(source: string, target: string, maxDistance: number): number {
  if (source === target) return 0;
  if (Math.abs(source.length - target.length) > maxDistance) return maxDistance + 1;

  let previousPrevious: number[] = [];
  let previous = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let i = 1; i <= source.length; i += 1) {
    const current = new Array<number>(target.length + 1);
    current[0] = i;
    let rowMinimum = current[0];

    for (let j = 1; j <= target.length; j += 1) {
      const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1;
      let distance = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );

      if (
        i > 1 &&
        j > 1 &&
        source[i - 1] === target[j - 2] &&
        source[i - 2] === target[j - 1]
      ) {
        distance = Math.min(distance, previousPrevious[j - 2] + 1);
      }

      current[j] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }

    if (rowMinimum > maxDistance) {
      return maxDistance + 1;
    }

    previousPrevious = previous;
    previous = current;
  }

  return previous[target.length];
}

function typoDistanceLimit(query: string): number {
  return query.length >= 6 ? 2 : 1;
}

function scoreTypoCandidate(query: string, candidate: string, score: number): number {
  if (query.length < 4 || candidate.length < 4) return 0;

  const comparable = candidate.length > query.length
    ? candidate.slice(0, query.length)
    : candidate;
  const maxDistance = typoDistanceLimit(query);
  const distance = editDistanceWithin(query, comparable, maxDistance);

  return distance <= maxDistance ? score - distance : 0;
}

function scoreSymbolTypoCandidate(query: string, candidate: string): number {
  if (query.length < 3 || candidate.length < 2) return 0;
  if (query[0] !== candidate[0]) return 0;

  const distance = editDistanceWithin(query, candidate, 1);
  return distance <= 1 ? SYMBOL_TYPO_SCORE - distance : 0;
}

export function getAssetSearchScore(asset: SearchableAsset, rawQuery: string): number {
  const query = normalizeSearchText(rawQuery);
  const compactQuery = compactSearchText(rawQuery);

  if (!query || !compactQuery) return 0;

  const symbol = normalizeSearchText(asset.symbol);
  const compactSymbol = compactSearchText(asset.symbol);
  const name = normalizeSearchText(asset.name);
  const compactName = compactSearchText(asset.name);
  const nameTokens = tokenize(asset.name);

  if (symbol === query || compactSymbol === compactQuery) return EXACT_SYMBOL_SCORE;
  if (symbol.startsWith(query) || compactSymbol.startsWith(compactQuery)) return SYMBOL_PREFIX_SCORE;
  if (symbol.includes(query) || compactSymbol.includes(compactQuery)) return SYMBOL_SUBSTRING_SCORE;
  if (name.startsWith(query) || compactName.startsWith(compactQuery)) return NAME_PREFIX_SCORE;
  if (nameTokens.some(token => token.startsWith(query))) return NAME_TOKEN_PREFIX_SCORE;
  if (name.includes(query) || compactName.includes(compactQuery)) return NAME_SUBSTRING_SCORE;

  const nameTypoScore = Math.max(
    scoreTypoCandidate(compactQuery, compactName, NAME_TYPO_SCORE),
    ...nameTokens.map(token => scoreTypoCandidate(compactQuery, token, NAME_TYPO_SCORE)),
  );

  return Math.max(scoreSymbolTypoCandidate(compactQuery, compactSymbol), nameTypoScore);
}
