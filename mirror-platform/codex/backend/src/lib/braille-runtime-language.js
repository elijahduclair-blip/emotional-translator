import { analyzeLetterAccountability } from './letter-accountability.js';
import { translateBrailleMath } from './braille-math.js';

const CAPITAL = '⠠';
const NUMERIC = '⠼';
const GRADE_ONE = '⠰';
const NEMETH_OPEN = '⠸⠩';
const NEMETH_CLOSE = '⠸⠱';
const BLANK = '\u2800';

const LETTERS = Object.freeze({
  a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓', i: '⠊', j: '⠚',
  k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞',
  u: '⠥', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵'
});
const DIGITS = Object.freeze({ '1': '⠁', '2': '⠃', '3': '⠉', '4': '⠙', '5': '⠑', '6': '⠋', '7': '⠛', '8': '⠓', '9': '⠊', '0': '⠚' });
const PUNCTUATION = Object.freeze({ ',': '⠂', ';': '⠆', ':': '⠒', '.': '⠲', '!': '⠖', '?': '⠦', '-': '⠤', "'": '⠄' });
const LETTER_BY_CELL = new Map(Object.entries(LETTERS).map(([letter, cell]) => [cell, letter]));
const DIGIT_BY_CELL = new Map(Object.entries(DIGITS).map(([digit, cell]) => [cell, digit]));
const PUNCTUATION_BY_CELL = new Map(Object.entries(PUNCTUATION).map(([mark, cell]) => [cell, mark]));
const MULTICELL_PUNCTUATION = Object.freeze({
  '"': '\u2820\u2836',
  '*': '\u2810\u2814',
  '\u201c': '\u2818\u2826',
  '\u201d': '\u2818\u2834',
  '\u2018': '\u2820\u2826',
  '\u2019': '\u2820\u2834'
});
const PUNCTUATION_BY_SEQUENCE = new Map(Object.entries(MULTICELL_PUNCTUATION).map(([mark, cells]) => [cells, mark]));
const COMPARISON_WORDS = Object.freeze({
  '>=': 'is greater than or equal to', '<=': 'is less than or equal to',
  '!=': 'is not equal to', '=': 'equals', '>': 'is greater than', '<': 'is less than'
});
const ACTIONS = Object.freeze({
  'propose a route': { id: 'propose_route', canonical: 'propose a route' },
  'propose route': { id: 'propose_route', canonical: 'propose a route' },
  'propose a relationship': { id: 'propose_relationship', canonical: 'propose a relationship' },
  'propose relationship': { id: 'propose_relationship', canonical: 'propose a relationship' },
  'propose a rule': { id: 'propose_rule', canonical: 'propose a rule' },
  'propose rule': { id: 'propose_rule', canonical: 'propose a rule' },
  'record evidence': { id: 'record_evidence', canonical: 'record evidence' },
  'evaluate pattern': { id: 'evaluate_pattern', canonical: 'evaluate pattern' }
});

export const BRAILLE_RUNTIME_VERSION = '0.1.0';
export const BRAILLE_RUNTIME_BOUNDARY = Object.freeze({
  mode: 'proposal_only',
  sourceMutationAllowed: false,
  generatedCodeExecutionAllowed: false,
  semanticMutationAllowed: false,
  colorAssignmentAllowed: false,
  graphMutationAllowed: false,
  reason: 'Braille Runtime Language may evaluate or compose an allowlisted proposal, but it cannot rewrite source, execute generated code, assign color meaning, or mutate the graph.'
});

export function compileBrailleRuntimeInstruction(input, observedValue) {
  const originalEnglish = String(input || '').trim();
  if (!originalEnglish) throw httpError(400, 'input is required.');
  if ([...originalEnglish].length > 2_000) throw httpError(413, 'Braille Runtime input must be 2000 Unicode code points or fewer.');
  const parsed = parseInstruction(originalEnglish);
  const evaluation = evaluateCondition(parsed.operator, parsed.value, observedValue);
  const canonicalEnglish = `When ${parsed.metric} ${COMPARISON_WORDS[parsed.operator]} ${parsed.value}, then ${parsed.action.canonical}.`;
  const uebText = transcribeEnglishToUeb(canonicalEnglish);
  const nemeth = translateBrailleMath({
    direction: 'print_to_nemeth',
    inputFormat: 'ascii_math',
    input: `x ${parsed.operator} ${parsed.value}`
  });
  const prefix = transcribeEnglishToUeb(`When ${parsed.metric}`);
  const suffix = transcribeEnglishToUeb(`then ${parsed.action.canonical}.`);
  const executableBraille = `${prefix}${BLANK}${NEMETH_OPEN}${BLANK}${nemeth.unicodeBraille}${BLANK}${NEMETH_CLOSE}${BLANK}${suffix}`;
  const sortableCells = brailleToCellRecords(executableBraille);
  const foundation = analyzeLetterAccountability(originalEnglish);

  return {
    engine: 'braille_runtime_language',
    version: BRAILLE_RUNTIME_VERSION,
    originalEnglish,
    canonicalEnglish,
    uebText,
    nemethCondition: nemeth.unicodeBraille,
    executableBraille,
    sortableCells,
    sortKey: sortableCells.map(cell => cell.mask.toString(16).padStart(2, '0')).join('-'),
    instruction: {
      type: 'conditional_proposal',
      condition: { metric: parsed.metric, variable: 'x', operator: parsed.operator, value: parsed.value },
      action: parsed.action.id,
      authority: 'proposal_only'
    },
    evaluation,
    proposal: {
      status: evaluation.conditionMet === true ? 'proposed' : evaluation.conditionMet === false ? 'not_triggered' : 'awaiting_context',
      action: parsed.action.id,
      sourceMutationAllowed: false
    },
    sortedWith: {
      layer: 'foundation',
      signatureIds: foundation.wordSequence.map(item => item.signatureId),
      distinctSignatures: foundation.signatures.length,
      occurrenceCount: foundation.wordSequence.length
    },
    provenance: {
      englishPreserved: true,
      uebTranscription: 'grade_1_bounded',
      mathNotation: 'nemeth_verified_subset'
    },
    boundary: BRAILLE_RUNTIME_BOUNDARY
  };
}

export function transcribeEnglishToUeb(value) {
  let output = '';
  let numericMode = false;
  const characters = [...String(value || '').normalize('NFC')];
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    if (/\s/u.test(character)) { output += BLANK; numericMode = false; continue; }
    if (/\d/u.test(character)) {
      if (!numericMode) output += NUMERIC;
      output += DIGITS[character];
      numericMode = true;
      continue;
    }
    if (character === '.' && numericMode && /\d/u.test(characters[index + 1] || '')) {
      output += PUNCTUATION['.'];
      continue;
    }
    if (MULTICELL_PUNCTUATION[character]) {
      output += MULTICELL_PUNCTUATION[character];
      numericMode = false;
      continue;
    }
    const lower = character.toLowerCase();
    if (LETTERS[lower]) {
      if (numericMode) output += GRADE_ONE;
      if (character !== lower) output += CAPITAL;
      output += LETTERS[lower];
      numericMode = false;
      continue;
    }
    numericMode = false;
    if (PUNCTUATION[character]) { output += PUNCTUATION[character]; continue; }
    throw httpError(422, `UEB version one does not support character: ${character}`);
  }
  return output;
}

export function brailleToCellRecords(value) {
  return [...String(value || '')].map((unicode, index) => {
    const offset = unicode.codePointAt(0) - 0x2800;
    if (offset < 0 || offset > 0xFF) throw httpError(422, `Non-Braille symbol at position ${index + 1}.`);
    const mask = offset & 0x3F;
    return {
      index: index + 1,
      unicode,
      mask,
      bits: mask.toString(2).padStart(6, '0'),
      dots: Array.from({ length: 6 }, (_, dot) => dot + 1).filter(dot => mask & (1 << (dot - 1)))
    };
  });
}

export function transcribeUebToEnglish(value) {
  const cells = [...String(value || '')];
  let output = '';
  let numericMode = false;
  let capitalNext = false;

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    const offset = cell.codePointAt(0) - 0x2800;
    if (offset < 0 || offset > 0x3F) throw httpError(422, `Expected a six-dot Braille cell at position ${index + 1}.`);
    if (cell === BLANK) { output += ' '; numericMode = false; capitalNext = false; continue; }
    const punctuationSequence = `${cell}${cells[index + 1] || ''}`;
    const multiCellPunctuation = PUNCTUATION_BY_SEQUENCE.get(punctuationSequence);
    if (multiCellPunctuation) {
      output += multiCellPunctuation;
      index += 1;
      numericMode = false;
      capitalNext = false;
      continue;
    }
    if (cell === CAPITAL) { capitalNext = true; continue; }
    if (cell === NUMERIC) { numericMode = true; continue; }
    if (cell === GRADE_ONE) { numericMode = false; continue; }

    if (numericMode) {
      const digit = DIGIT_BY_CELL.get(cell);
      if (digit !== undefined) { output += digit; continue; }
      if (cell === PUNCTUATION['.'] && DIGIT_BY_CELL.has(cells[index + 1])) { output += '.'; continue; }
      numericMode = false;
    }

    const letter = LETTER_BY_CELL.get(cell);
    if (letter) {
      output += capitalNext ? letter.toUpperCase() : letter;
      capitalNext = false;
      continue;
    }
    const punctuation = PUNCTUATION_BY_CELL.get(cell);
    if (punctuation) { output += punctuation; capitalNext = false; continue; }
    throw httpError(422, `Unsupported Grade-1 UEB cell at position ${index + 1}.`);
  }

  if (capitalNext) throw httpError(422, 'Capital indicator must be followed by a letter.');
  return output;
}

function parseInstruction(input) {
  const match = input.match(/^when\s+(.+?)\s*(>=|<=|!=|=|>|<)\s*(-?\d+(?:\.\d+)?)\s*,?\s*(?:then\s+)?(.+?)[.!?]?$/iu);
  if (!match) throw httpError(422, 'Use: when [metric] [comparison] [number], then [allowlisted action].');
  const metric = match[1].trim().replace(/\s+/g, ' ').toLowerCase();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]{0,79}$/u.test(metric)) throw httpError(422, 'The condition metric contains unsupported characters.');
  const actionText = match[4].trim().toLowerCase();
  const action = ACTIONS[actionText];
  if (!action) throw httpError(422, `Unsupported action. Allowed actions: ${[...new Set(Object.values(ACTIONS).map(item => item.canonical))].join(', ')}.`);
  return { metric, operator: match[2], value: match[3], action };
}

function evaluateCondition(operator, threshold, observedValue) {
  if (observedValue === undefined || observedValue === null || observedValue === '') {
    return { status: 'awaiting_context', observedValue: null, conditionMet: null };
  }
  const observed = Number(observedValue);
  const expected = Number(threshold);
  if (!Number.isFinite(observed)) throw httpError(400, 'observedValue must be a finite number.');
  const conditionMet = operator === '>=' ? observed >= expected
    : operator === '<=' ? observed <= expected
      : operator === '!=' ? observed !== expected
        : operator === '=' ? observed === expected
          : operator === '>' ? observed > expected
            : observed < expected;
  return { status: 'evaluated', observedValue: observed, conditionMet };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
