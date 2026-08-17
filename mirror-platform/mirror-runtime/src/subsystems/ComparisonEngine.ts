const MAX_COMPARISONS = 5;
const MAX_TOKENS_PER_OBSERVATION = 128;
const MAX_DIFFERENCES_PER_COMPARISON = 16;
const MAX_RECURRING_UNITS = 12;

const COMMON_FUNCTION_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'do', 'does', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'is', 'it', 'its',
  'me', 'my', 'of', 'on', 'or', 'our', 'ours', 'she', 'so', 'that', 'the', 'their', 'theirs', 'them',
  'then', 'there', 'they', 'this', 'to', 'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your', 'yours'
]);

export interface ConversationObservation {
  sequence?: unknown;
  interactionId?: unknown;
  role?: unknown;
  content?: unknown;
}

export interface TokenDifference {
  type: 'substitution' | 'insertion' | 'deletion';
  priorPosition: number | null;
  currentPosition: number | null;
  priorToken: string | null;
  currentToken: string | null;
}

export interface ObservationComparison {
  observationSequence: number;
  interactionId: string | null;
  relevanceScore: number;
  dimensions: {
    exactNormalizedText: boolean;
    exactTokenOrder: boolean;
    orderedTokenSimilarity: number;
    sharedTokens: string[];
    sharedPhrases: string[];
    introducedTokens: string[];
    omittedTokens: string[];
  };
  differences: TokenDifference[];
  differenceCount: number;
  differencesTruncated: boolean;
}

export interface RecurringLanguageUnit {
  value: string;
  supportCount: number;
  observationSequences: number[];
  status: 'observation_only';
}

export interface ComparisonLedger {
  version: 'ari-comparison.v1';
  operation: 'bounded_structural_comparison';
  currentObservation: {
    sequence: number | null;
    normalizedText: string;
    tokenCount: number;
    tokensTruncated: boolean;
  };
  selection: {
    availablePersonObservations: number;
    comparedObservationCount: number;
    maximumComparisons: number;
    maximumTokensPerObservation: number;
    contextTruncated: boolean;
  };
  comparisons: ObservationComparison[];
  recurringLanguage: {
    tokens: RecurringLanguageUnit[];
    phrases: RecurringLanguageUnit[];
  };
  summary: {
    strongestObservationSequence: number | null;
    repeatedTokenCount: number;
    repeatedPhraseCount: number;
    notice: string;
  };
  boundary: {
    mode: 'observation_only';
    comparisonCreatesMeaning: false;
    semanticMutationAllowed: false;
    graphMutationAllowed: false;
    colorAtlasMutationAllowed: false;
    automaticLearningAllowed: false;
  };
}

interface PreparedObservation {
  sequence: number;
  interactionId: string | null;
  normalizedText: string;
  tokens: string[];
  tokensTruncated: boolean;
  recencyRank: number;
}

export class ComparisonEngine {
  compare(
    currentText: string,
    events: ConversationObservation[],
    currentSequence: number | null = null,
    contextTruncated = false
  ): ComparisonLedger {
    const current = prepareText(currentText);
    const previous = events
      .filter(event => event?.role === 'user' && typeof event.content === 'string' && event.content.trim())
      .map((event, index, all) => prepareObservation(event, all.length - index))
      .filter((event): event is PreparedObservation => event !== null);

    const ranked = previous
      .map(observation => compareObservation(current, observation))
      .sort((left, right) =>
        right.comparison.relevanceScore - left.comparison.relevanceScore ||
        right.comparison.observationSequence - left.comparison.observationSequence
      )
      .slice(0, MAX_COMPARISONS);
    const comparisons = ranked.map(item => item.comparison);
    const selectedObservations = ranked.map(item => item.observation);
    const recurringLanguage = recurringUnits(current.tokens, currentSequence, selectedObservations);
    const strongestObservationSequence = comparisons[0]?.observationSequence || null;

    return {
      version: 'ari-comparison.v1',
      operation: 'bounded_structural_comparison',
      currentObservation: {
        sequence: validSequence(currentSequence),
        normalizedText: current.normalizedText,
        tokenCount: current.totalTokenCount,
        tokensTruncated: current.tokensTruncated
      },
      selection: {
        availablePersonObservations: previous.length,
        comparedObservationCount: comparisons.length,
        maximumComparisons: MAX_COMPARISONS,
        maximumTokensPerObservation: MAX_TOKENS_PER_OBSERVATION,
        contextTruncated
      },
      comparisons,
      recurringLanguage,
      summary: {
        strongestObservationSequence,
        repeatedTokenCount: recurringLanguage.tokens.length,
        repeatedPhraseCount: recurringLanguage.phrases.length,
        notice: comparisons.length
          ? `Compared with ${comparisons.length} earlier person observation${comparisons.length === 1 ? '' : 's'}. Exact language recurrence is evidence of repetition, not proof of shared meaning.`
          : 'No earlier person observation was available. The current statement remains an identified observation without a comparison claim.'
      },
      boundary: {
        mode: 'observation_only',
        comparisonCreatesMeaning: false,
        semanticMutationAllowed: false,
        graphMutationAllowed: false,
        colorAtlasMutationAllowed: false,
        automaticLearningAllowed: false
      }
    };
  }
}

function prepareObservation(event: ConversationObservation, recencyRank: number): PreparedObservation | null {
  const sequence = validSequence(event.sequence);
  if (sequence === null) return null;
  const prepared = prepareText(String(event.content || ''));
  return {
    sequence,
    interactionId: typeof event.interactionId === 'string' ? event.interactionId.slice(0, 120) : null,
    normalizedText: prepared.normalizedText,
    tokens: prepared.tokens,
    tokensTruncated: prepared.tokensTruncated,
    recencyRank
  };
}

function prepareText(value: string) {
  const normalizedText = String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('en-US')
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim();
  const allTokens = normalizedText.match(/[\p{L}\p{N}]+(?:['_-][\p{L}\p{N}]+)*/gu) || [];
  return {
    normalizedText,
    tokens: allTokens.slice(0, MAX_TOKENS_PER_OBSERVATION),
    totalTokenCount: allTokens.length,
    tokensTruncated: allTokens.length > MAX_TOKENS_PER_OBSERVATION
  };
}

function compareObservation(current: ReturnType<typeof prepareText>, observation: PreparedObservation) {
  const currentSet = new Set(current.tokens);
  const previousSet = new Set(observation.tokens);
  const sharedTokens = sorted([...currentSet].filter(token => previousSet.has(token)));
  const introducedTokens = sorted([...currentSet].filter(token => !previousSet.has(token)));
  const omittedTokens = sorted([...previousSet].filter(token => !currentSet.has(token)));
  const currentPhrases = phraseSet(current.tokens);
  const previousPhrases = phraseSet(observation.tokens);
  const sharedPhrases = sorted([...currentPhrases].filter(phrase => previousPhrases.has(phrase)));
  const orderedTokenSimilarity = roundRatio(longestCommonSubsequenceLength(observation.tokens, current.tokens), Math.max(observation.tokens.length, current.tokens.length));
  const tokenUnionSize = new Set([...current.tokens, ...observation.tokens]).size;
  const tokenSimilarity = roundRatio(sharedTokens.length, tokenUnionSize);
  const phraseCoverage = roundRatio(sharedPhrases.length, Math.max(1, currentPhrases.size));
  const recencyScore = 1 / Math.max(1, observation.recencyRank);
  const relevanceScore = roundNumber(tokenSimilarity * 0.5 + phraseCoverage * 0.3 + orderedTokenSimilarity * 0.15 + recencyScore * 0.05);
  const allDifferences = alignDifferences(observation.tokens, current.tokens);

  return {
    observation,
    comparison: {
      observationSequence: observation.sequence,
      interactionId: observation.interactionId,
      relevanceScore,
      dimensions: {
        exactNormalizedText: current.normalizedText === observation.normalizedText,
        exactTokenOrder: arraysEqual(current.tokens, observation.tokens),
        orderedTokenSimilarity,
        sharedTokens: sharedTokens.slice(0, MAX_RECURRING_UNITS),
        sharedPhrases: sharedPhrases.slice(0, MAX_RECURRING_UNITS),
        introducedTokens: introducedTokens.slice(0, MAX_RECURRING_UNITS),
        omittedTokens: omittedTokens.slice(0, MAX_RECURRING_UNITS)
      },
      differences: allDifferences.slice(0, MAX_DIFFERENCES_PER_COMPARISON),
      differenceCount: allDifferences.length,
      differencesTruncated: allDifferences.length > MAX_DIFFERENCES_PER_COMPARISON
    }
  };
}

function recurringUnits(currentTokens: string[], currentSequence: number | null, observations: PreparedObservation[]) {
  const sources = [
    { sequence: validSequence(currentSequence), tokens: currentTokens },
    ...observations.map(observation => ({ sequence: observation.sequence, tokens: observation.tokens }))
  ];
  return {
    tokens: collectRecurring(sources, tokens => new Set(tokens.filter(token => !COMMON_FUNCTION_WORDS.has(token) && token.length > 1))),
    phrases: collectRecurring(sources, tokens => phraseSet(tokens))
  };
}

function collectRecurring(
  sources: Array<{ sequence: number | null; tokens: string[] }>,
  units: (tokens: string[]) => Set<string>
): RecurringLanguageUnit[] {
  const support = new Map<string, Set<number>>();
  sources.forEach((source, sourceIndex) => {
    const sequence = source.sequence ?? -(sourceIndex + 1);
    units(source.tokens).forEach(value => {
      if (!support.has(value)) support.set(value, new Set());
      support.get(value)!.add(sequence);
    });
  });
  return [...support.entries()]
    .filter(([, sequences]) => sequences.size >= 2)
    .map(([value, sequences]) => ({
      value,
      supportCount: sequences.size,
      observationSequences: [...sequences].filter(sequence => sequence > 0).sort((left, right) => left - right),
      status: 'observation_only' as const
    }))
    .sort((left, right) => right.supportCount - left.supportCount || left.value.localeCompare(right.value))
    .slice(0, MAX_RECURRING_UNITS);
}

function phraseSet(tokens: string[]) {
  const phrases = new Set<string>();
  for (let width = 2; width <= 3; width += 1) {
    for (let index = 0; index + width <= tokens.length; index += 1) {
      phrases.add(tokens.slice(index, index + width).join(' '));
    }
  }
  return phrases;
}

function longestCommonSubsequenceLength(left: string[], right: string[]) {
  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? previous[rightIndex - 1] + 1
        : Math.max(previous[rightIndex], current[rightIndex - 1]);
    }
    for (let index = 0; index <= right.length; index += 1) previous[index] = current[index];
    current.fill(0);
  }
  return previous[right.length];
}

function alignDifferences(prior: string[], current: string[]): TokenDifference[] {
  const rows = prior.length + 1;
  const columns = current.length + 1;
  const distance = Array.from({ length: rows }, () => new Array(columns).fill(0));
  for (let row = 0; row < rows; row += 1) distance[row][0] = row;
  for (let column = 0; column < columns; column += 1) distance[0][column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = prior[row - 1] === current[column - 1] ? 0 : 1;
      distance[row][column] = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + cost
      );
    }
  }

  const differences: TokenDifference[] = [];
  let row = prior.length;
  let column = current.length;
  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && prior[row - 1] === current[column - 1]) {
      row -= 1;
      column -= 1;
      continue;
    }
    if (row > 0 && column > 0 && distance[row][column] === distance[row - 1][column - 1] + 1) {
      differences.push({
        type: 'substitution', priorPosition: row, currentPosition: column,
        priorToken: prior[row - 1], currentToken: current[column - 1]
      });
      row -= 1;
      column -= 1;
      continue;
    }
    if (column > 0 && distance[row][column] === distance[row][column - 1] + 1) {
      differences.push({ type: 'insertion', priorPosition: null, currentPosition: column, priorToken: null, currentToken: current[column - 1] });
      column -= 1;
      continue;
    }
    differences.push({ type: 'deletion', priorPosition: row, currentPosition: null, priorToken: prior[row - 1], currentToken: null });
    row -= 1;
  }
  return differences.reverse();
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sorted(values: string[]) {
  return values.sort((left, right) => left.localeCompare(right));
}

function validSequence(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function roundRatio(numerator: number, denominator: number) {
  return denominator > 0 ? roundNumber(numerator / denominator) : numerator === 0 ? 1 : 0;
}

function roundNumber(value: number) {
  return Math.round(value * 1000) / 1000;
}
