const LETTER_PATTERN = /\p{L}/u;
const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+(?:['’\-‐-―][\p{L}\p{M}\p{N}]+)*/gu;
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });

export const LETTER_ACCOUNTABILITY_VERSION = '1.0.0';
export const LETTER_ACCOUNTABILITY_BOUNDARY = Object.freeze({
  mode: 'structure_only',
  semanticMutationAllowed: false,
  colorAssignmentAllowed: false,
  graphMutationAllowed: false,
  brailleMeaningInherited: false,
  reason: 'Ordered letter accountability records symbol structure only. StructuralCell values are not Braille and do not assign meaning.'
});

export function analyzeLetterAccountability(text) {
  const input = String(text || '');
  const { occurrences, nonWordSegments } = extractPassage(input);
  const signatures = [];
  const signatureByWord = new Map();
  const wordSequence = occurrences.map((occurrence, index) => {
    let signature = signatureByWord.get(occurrence.normalizedWord);
    if (!signature) {
      signature = buildWordSignature(occurrence.surface, `w${signatures.length + 1}`);
      signatures.push(signature);
      signatureByWord.set(signature.normalizedWord, signature);
    }
    if (!signature.surfaceForms.includes(occurrence.surface)) signature.surfaceForms.push(occurrence.surface);
    return {
      occurrence: index + 1,
      signatureId: signature.id,
      surface: occurrence.surface,
      start: occurrence.start,
      end: occurrence.end
    };
  });

  return {
    version: LETTER_ACCOUNTABILITY_VERSION,
    boundary: LETTER_ACCOUNTABILITY_BOUNDARY,
    totals: {
      occurrences: wordSequence.length,
      distinctSignatures: signatures.length,
      accountedLetters: wordSequence.reduce((sum, item) => sum + signatures[Number(item.signatureId.slice(1)) - 1].letterCount, 0)
    },
    signatures,
    wordSequence,
    nonWordSegments
  };
}

export function compareLetterPatterns(left, right) {
  const leftSignature = buildWordSignature(requireWord(left, 'left'), 'left');
  const rightSignature = buildWordSignature(requireWord(right, 'right'), 'right');
  const leftLetters = leftSignature.letters.map(letter => letter.normalized);
  const rightLetters = rightSignature.letters.map(letter => letter.normalized);
  const differences = leftLetters.length === rightLetters.length
    ? compareEqualLength(leftSignature.letters, rightSignature.letters)
    : alignDifferentLengths(leftSignature.letters, rightSignature.letters);
  return {
    version: LETTER_ACCOUNTABILITY_VERSION,
    boundary: LETTER_ACCOUNTABILITY_BOUNDARY,
    left: leftSignature,
    right: rightSignature,
    differences,
    differenceCount: differences.length,
    identical: differences.length === 0
  };
}

export function buildWordSignature(surface, id = 'word') {
  const normalizedSurface = String(surface || '').normalize('NFC');
  const graphemes = segmentGraphemes(normalizedSurface);
  const letters = [];
  const nonLetterMarks = [];
  for (let surfaceIndex = 0; surfaceIndex < graphemes.length; surfaceIndex += 1) {
    const grapheme = graphemes[surfaceIndex];
    if (!LETTER_PATTERN.test(grapheme)) {
      nonLetterMarks.push({ surfacePosition: surfaceIndex + 1, value: grapheme });
      continue;
    }
    const normalized = grapheme.normalize('NFC').toLowerCase();
    const codePoints = [...normalized].map(character => character.codePointAt(0));
    letters.push({
      position: letters.length + 1,
      surfacePosition: surfaceIndex + 1,
      surface: grapheme,
      normalized,
      codePoints,
      unicode: codePoints.map(codePoint => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`),
      structuralCells: codePoints.flatMap(codePointToStructuralCells)
    });
  }
  if (!letters.length) throw httpError(422, 'A word must contain at least one Unicode letter.');
  const normalizedWord = letters.map(letter => letter.normalized).join('');
  return {
    id,
    normalizedWord,
    surfaceForms: [String(surface || '')],
    letterCount: letters.length,
    letters,
    letterFrequencies: buildFrequencies(letters),
    nonLetterMarks
  };
}

export function codePointToStructuralCells(codePoint) {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) throw new RangeError('Invalid Unicode code point.');
  const bits = codePoint.toString(2).padStart(24, '0');
  return Array.from({ length: 4 }, (_, index) => {
    const cellBits = bits.slice(index * 6, index * 6 + 6);
    return {
      index: index + 1,
      bits: cellBits,
      value: Number.parseInt(cellBits, 2),
      activePositions: [...cellBits].flatMap((bit, position) => bit === '1' ? [position + 1] : [])
    };
  });
}

export function structuralCellsToCodePoint(cells) {
  if (!Array.isArray(cells) || cells.length !== 4 || cells.some(cell => !/^[01]{6}$/.test(String(cell?.bits || '')))) {
    throw new TypeError('Exactly four six-bit StructuralCell values are required.');
  }
  const codePoint = Number.parseInt(cells.map(cell => cell.bits).join(''), 2);
  if (codePoint > 0x10FFFF) throw new RangeError('StructuralCell sequence is outside Unicode.');
  return codePoint;
}

export function countGraphemes(value) {
  return segmentGraphemes(String(value || '')).length;
}

function extractPassage(input) {
  const occurrences = [];
  const nonWordSegments = [];
  let cursor = 0;
  for (const match of input.matchAll(WORD_PATTERN)) {
    if (match.index > cursor) nonWordSegments.push({
      start: [...input.slice(0, cursor)].length,
      end: [...input.slice(0, match.index)].length,
      value: input.slice(cursor, match.index)
    });
    cursor = match.index + match[0].length;
    if (!LETTER_PATTERN.test(match[0])) {
      nonWordSegments.push({
        start: [...input.slice(0, match.index)].length,
        end: [...input.slice(0, cursor)].length,
        value: match[0]
      });
      continue;
    }
    const signature = buildWordSignature(match[0], 'candidate');
    occurrences.push({
      surface: match[0],
      normalizedWord: signature.normalizedWord,
      start: [...input.slice(0, match.index)].length,
      end: [...input.slice(0, match.index + match[0].length)].length
    });
  }
  if (cursor < input.length) nonWordSegments.push({
    start: [...input.slice(0, cursor)].length,
    end: [...input].length,
    value: input.slice(cursor)
  });
  return { occurrences, nonWordSegments };
}

function buildFrequencies(letters) {
  const frequencies = new Map();
  for (const letter of letters) {
    const current = frequencies.get(letter.normalized) || { letter: letter.normalized, count: 0, positions: [] };
    current.count += 1;
    current.positions.push(letter.position);
    frequencies.set(letter.normalized, current);
  }
  return [...frequencies.values()];
}

function compareEqualLength(left, right) {
  return left.flatMap((letter, index) => letter.normalized === right[index].normalized ? [] : [{
    operation: 'substitution',
    leftPosition: index + 1,
    rightPosition: index + 1,
    left: letter.normalized,
    right: right[index].normalized
  }]);
}

function alignDifferentLengths(left, right) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const cost = Array.from({ length: rows }, () => Array(columns).fill(0));
  for (let row = left.length; row >= 0; row -= 1) {
    for (let column = right.length; column >= 0; column -= 1) {
      if (row === left.length) cost[row][column] = right.length - column;
      else if (column === right.length) cost[row][column] = left.length - row;
      else if (left[row].normalized === right[column].normalized) cost[row][column] = cost[row + 1][column + 1];
      else cost[row][column] = 1 + Math.min(cost[row + 1][column + 1], cost[row + 1][column], cost[row][column + 1]);
    }
  }

  const differences = [];
  let row = 0;
  let column = 0;
  while (row < left.length || column < right.length) {
    if (row < left.length && column < right.length && left[row].normalized === right[column].normalized) {
      row += 1; column += 1; continue;
    }
    if (row < left.length && column < right.length && cost[row][column] === 1 + cost[row + 1][column + 1]) {
      differences.push({ operation: 'substitution', leftPosition: row + 1, rightPosition: column + 1, left: left[row].normalized, right: right[column].normalized });
      row += 1; column += 1; continue;
    }
    if (row < left.length && cost[row][column] === 1 + cost[row + 1][column]) {
      differences.push({ operation: 'deletion', leftPosition: row + 1, rightPosition: null, left: left[row].normalized, right: null });
      row += 1; continue;
    }
    differences.push({ operation: 'insertion', leftPosition: null, rightPosition: column + 1, left: null, right: right[column].normalized });
    column += 1;
  }
  return differences;
}

function requireWord(value, field) {
  const word = String(value || '').trim();
  if (!word) throw httpError(400, `${field} is required.`);
  return word;
}

function segmentGraphemes(value) {
  return [...segmenter.segment(value)].map(item => item.segment);
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
