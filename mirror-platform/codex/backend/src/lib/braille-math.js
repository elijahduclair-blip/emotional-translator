const BLANK = '\u2800';
const NUMERIC = '⠼';
const NEMETH_OPEN = '⠸⠩';
const NEMETH_CLOSE = '⠸⠱';

const DIGITS = Object.freeze({
  '1': '⠂', '2': '⠆', '3': '⠒', '4': '⠲', '5': '⠢',
  '6': '⠖', '7': '⠶', '8': '⠦', '9': '⠔', '0': '⠴'
});
const DIGIT_BY_CELL = reverse(DIGITS);
const LETTERS = Object.freeze(Object.fromEntries(
  [...'abcdefghijklmnopqrstuvwxyz'].map(letter => [letter, String.fromCodePoint(0x2800 + brailleMask(letter))])
));
const LETTER_BY_CELL = reverse(LETTERS);
const OPERATORS = Object.freeze({ '+': '⠬', '-': '⠤', '*': '⠈⠡', '/': '⠨⠌' });
const COMPARISONS = Object.freeze({ '=': '⠨⠅', '!=': '⠌⠨⠅', '<': '⠐⠅', '>': '⠨⠂', '<=': '⠐⠅⠱', '>=': '⠨⠂⠱' });
const GROUPS = Object.freeze({ '(': '⠷', ')': '⠾', '[': '⠈⠷', ']': '⠈⠾' });
const DOTS_BY_CELL = new Map();

export const BRAILLE_STANDARD_REFERENCES = Object.freeze([
  { id: 'bana-nemeth-2022', title: 'The Nemeth Braille Code for Mathematics and Science Notation 2022', authority: 'BANA', url: 'https://www.brailleauthority.org/nemeth-code' },
  { id: 'ueb-rules-2024', title: 'Rules of Unified English Braille, Third Edition 2024', authority: 'ICEB', url: 'https://iceb.org/publications/ueb/' },
  { id: 'aph-braille-brain', title: 'Braille Brain Nemeth course', authority: 'APH', url: 'https://braillebrain.aphtech.org/nemeth' }
]);

export const NOTATION_BOUNDARY = Object.freeze({
  mode: 'notation_only',
  semanticMutationAllowed: false,
  colorAssignmentAllowed: false,
  graphMutationAllowed: false,
  reason: 'Braille math conversion represents notation only; it does not judge mathematical truth, assign color meaning, or modify the semantic graph.'
});

export function translateBrailleMath({ direction, input, inputFormat }) {
  const value = String(input || '').trim();
  if (!value) throw httpError(400, 'input is required.');
  if (value.length > 512) throw httpError(413, 'Braille math input exceeds 512 characters.');
  if (!['print_to_nemeth', 'nemeth_to_print'].includes(direction)) throw httpError(400, 'direction must be print_to_nemeth or nemeth_to_print.');
  if (direction === 'print_to_nemeth' && inputFormat !== 'ascii_math') throw httpError(400, 'print_to_nemeth requires inputFormat ascii_math.');
  if (direction === 'nemeth_to_print' && inputFormat !== 'unicode_braille') throw httpError(400, 'nemeth_to_print requires inputFormat unicode_braille.');

  try {
    const printInput = direction === 'nemeth_to_print' ? nemethToAscii(value) : value;
    const ast = new Parser(tokenize(printInput)).parse();
    const normalizedPrint = printAst(ast);
    const unicodeBraille = astToNemeth(ast);
    return {
      direction,
      inputFormat,
      supported: true,
      normalizedPrint,
      mathml: mathml(ast),
      spoken: speak(ast),
      unicodeBraille,
      uebContextBraille: `${NEMETH_OPEN}${BLANK}${unicodeBraille}${BLANK}${NEMETH_CLOSE}`,
      cells: [...unicodeBraille].map((cell, index) => cell === ' ' || cell === BLANK
        ? { index, unicode: BLANK, dots: [], label: 'space' }
        : { index, unicode: cell, dots: dotsForCell(cell), label: `dots ${dotsForCell(cell).join('-') || 'none'}` }),
      recognizedTokens: tokenize(normalizedPrint).filter(token => token.type !== 'eof').map(token => token.value),
      unsupported: [],
      standardReferences: BRAILLE_STANDARD_REFERENCES,
      boundary: NOTATION_BOUNDARY
    };
  } catch (error) {
    if (error?.status) throw error;
    throw httpError(422, error instanceof Error ? error.message : 'Unsupported Braille math notation.');
  }
}

export function checkBrailleMath({ direction, prompt, answer }) {
  const expected = translateBrailleMath({
    direction,
    input: prompt,
    inputFormat: direction === 'print_to_nemeth' ? 'ascii_math' : 'unicode_braille'
  });
  const normalizedAnswer = direction === 'print_to_nemeth'
    ? String(answer || '').replaceAll(BLANK, ' ').trim()
    : printAst(new Parser(tokenize(String(answer || ''))).parse());
  const target = direction === 'print_to_nemeth' ? expected.unicodeBraille.replaceAll(BLANK, ' ') : expected.normalizedPrint;
  const correct = normalizedAnswer === target;
  return {
    correct,
    expected: target,
    normalizedAnswer,
    mistakeCategories: correct ? [] : [direction === 'print_to_nemeth' ? 'braille_cell_sequence' : 'print_structure'],
    boundary: NOTATION_BOUNDARY
  };
}

export function dotsToUnicode(dots) {
  const normalized = [...new Set((Array.isArray(dots) ? dots : []).map(Number))].sort();
  if (normalized.some(dot => !Number.isInteger(dot) || dot < 1 || dot > 6)) throw httpError(400, 'dots must contain only integers 1 through 6.');
  const mask = normalized.reduce((value, dot) => value | (1 << (dot - 1)), 0);
  return String.fromCodePoint(0x2800 + mask);
}

function astToNemeth(ast) {
  const state = { numeric: false, suppressNumeric: false };
  return emit(ast, state).replaceAll(' ', BLANK);
}

function emit(node, state) {
  if (node.type === 'number') {
    let output = '';
    if (!state.numeric && !state.suppressNumeric) output += NUMERIC;
    output += [...node.value].map(character => character === '.' ? '⠨⠂' : DIGITS[character]).join('');
    state.numeric = true;
    return output;
  }
  if (node.type === 'variable') {
    state.numeric = false;
    return LETTERS[node.name];
  }
  if (node.type === 'unary') {
    const output = OPERATORS[node.op];
    state.numeric = false;
    return output + emit(node.value, state);
  }
  if (node.type === 'group') {
    const open = GROUPS[node.open];
    const close = GROUPS[node.open === '(' ? ')' : ']'];
    const previous = state.suppressNumeric;
    state.suppressNumeric = true;
    state.numeric = true;
    const middle = emit(node.value, state);
    state.suppressNumeric = previous;
    state.numeric = false;
    return open + middle + close;
  }
  if (node.type === 'fraction') {
    const previous = state.suppressNumeric;
    state.suppressNumeric = true;
    state.numeric = true;
    const numerator = emit(node.numerator, state);
    state.numeric = true;
    const denominator = emit(node.denominator, state);
    state.suppressNumeric = previous;
    state.numeric = false;
    return `⠹${numerator}⠌${denominator}⠼`;
  }
  if (node.type === 'power') {
    const base = emit(node.base, state);
    const previous = state.suppressNumeric;
    state.suppressNumeric = true;
    state.numeric = true;
    const exponent = emit(node.exponent, state);
    state.suppressNumeric = previous;
    state.numeric = false;
    return `${base}⠘${exponent}`;
  }
  if (node.type === 'binary') {
    const left = emit(node.left, state);
    if (node.implicit) {
      state.numeric = false;
      return left + emit(node.right, state);
    }
    if (COMPARISONS[node.op]) {
      state.numeric = false;
      return `${left} ${COMPARISONS[node.op]} ${emit(node.right, state)}`;
    }
    const operator = OPERATORS[node.op];
    return left + operator + emit(node.right, state);
  }
  throw new Error('Unsupported expression structure.');
}

function nemethToAscii(value) {
  let source = value.replaceAll(BLANK, ' ').trim();
  if (source.startsWith(NEMETH_OPEN) && source.endsWith(NEMETH_CLOSE)) {
    source = source.slice(NEMETH_OPEN.length, -NEMETH_CLOSE.length).trim();
  }
  let index = 0;
  let numeric = false;
  let fractionDepth = 0;
  let output = '';
  while (index < source.length) {
    if (source[index] === ' ') { output += ' '; numeric = false; index += 1; continue; }
    const comparison = matchSequence(source, index, COMPARISONS);
    if (comparison) { output += comparison.key; index += comparison.value.length; numeric = false; continue; }
    const operator = matchSequence(source, index, OPERATORS);
    if (operator) { output += operator.key; index += operator.value.length; continue; }
    const group = matchSequence(source, index, GROUPS);
    if (group) { output += group.key; index += group.value.length; numeric = ['(', '['].includes(group.key); continue; }
    const cell = source[index];
    if (cell === NUMERIC && fractionDepth === 0) { numeric = true; index += 1; continue; }
    if (cell === '⠹') { output += 'frac('; fractionDepth += 1; numeric = true; index += 1; continue; }
    if (cell === '⠌' && fractionDepth > 0) { output += ','; numeric = true; index += 1; continue; }
    if (cell === '⠼' && fractionDepth > 0) { output += ')'; fractionDepth -= 1; numeric = false; index += 1; continue; }
    if (cell === '⠘') { output += '^'; numeric = true; index += 1; continue; }
    if (cell === '⠨' && source[index + 1] === '⠂' && numeric) { output += '.'; index += 2; continue; }
    if (numeric && DIGIT_BY_CELL[cell]) { output += DIGIT_BY_CELL[cell]; index += 1; continue; }
    if (LETTER_BY_CELL[cell]) { output += LETTER_BY_CELL[cell]; numeric = false; index += 1; continue; }
    throw new Error(`Unsupported Braille cell at position ${index + 1}: ${cell}`);
  }
  if (fractionDepth) throw new Error('Unclosed Nemeth fraction indicator.');
  return output;
}

class Parser {
  constructor(tokens) { this.tokens = tokens; this.index = 0; }
  parse() {
    const expression = this.comparison();
    this.expect('eof');
    return expression;
  }
  comparison() {
    let left = this.sum();
    while (this.peek().type === 'comparison') {
      const op = this.take().value;
      left = { type: 'binary', op, left, right: this.sum() };
    }
    return left;
  }
  sum() {
    let left = this.product();
    while (this.peek().type === 'operator' && ['+', '-'].includes(this.peek().value)) {
      const op = this.take().value;
      left = { type: 'binary', op, left, right: this.product() };
    }
    return left;
  }
  product() {
    let left = this.power();
    while (true) {
      if (this.peek().type === 'operator' && ['*', '/'].includes(this.peek().value)) {
        const op = this.take().value;
        left = { type: 'binary', op, left, right: this.power() };
      } else if (['number', 'identifier', 'open', 'frac'].includes(this.peek().type)) {
        left = { type: 'binary', op: '*', implicit: true, left, right: this.power() };
      } else break;
    }
    return left;
  }
  power() {
    let base = this.unary();
    if (this.peek().type === 'power') {
      this.take();
      const exponent = this.unary();
      if (exponent.type !== 'number' || !/^\d+$/.test(exponent.value)) throw new Error('Version one supports only non-negative integer exponents.');
      base = { type: 'power', base, exponent };
    }
    return base;
  }
  unary() {
    if (this.peek().type === 'operator' && ['+', '-'].includes(this.peek().value)) {
      return { type: 'unary', op: this.take().value, value: this.unary() };
    }
    return this.primary();
  }
  primary() {
    const token = this.take();
    if (token.type === 'number') return { type: 'number', value: token.value };
    if (token.type === 'identifier') return { type: 'variable', name: token.value };
    if (token.type === 'frac') {
      this.expect('open', '(');
      const numerator = this.comparison();
      this.expect('comma');
      const denominator = this.comparison();
      this.expect('close', ')');
      return { type: 'fraction', numerator, denominator };
    }
    if (token.type === 'open') {
      const value = this.comparison();
      this.expect('close', token.value === '(' ? ')' : ']');
      return { type: 'group', open: token.value, value };
    }
    throw new Error(`Unsupported or incomplete expression near "${token.value || 'end'}".`);
  }
  peek() { return this.tokens[this.index]; }
  take() { return this.tokens[this.index++]; }
  expect(type, value) {
    const token = this.take();
    if (token.type !== type || (value !== undefined && token.value !== value)) throw new Error(`Expected ${value || type}.`);
    return token;
  }
}

function tokenize(input) {
  const source = String(input || '').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').replaceAll('≤', '<=').replaceAll('≥', '>=').replaceAll('≠', '!=');
  if (/\b(?:sqrt|root|sin|cos|tan|log|ln|lim|integral|matrix)\b/i.test(source)) {
    throw new Error('Unsupported advanced structure in version one.');
  }
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { index += whitespace[0].length; continue; }
    const number = rest.match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
    if (number) { tokens.push({ type: 'number', value: number[0] }); index += number[0].length; continue; }
    if (/^frac\b/i.test(rest)) { tokens.push({ type: 'frac', value: 'frac' }); index += 4; continue; }
    const identifier = rest.match(/^[a-z]/i);
    if (identifier) { tokens.push({ type: 'identifier', value: identifier[0].toLowerCase() }); index += 1; continue; }
    const comparison = rest.match(/^(?:<=|>=|!=|=|<|>)/);
    if (comparison) { tokens.push({ type: 'comparison', value: comparison[0] }); index += comparison[0].length; continue; }
    const character = rest[0];
    if ('+-*/'.includes(character)) tokens.push({ type: 'operator', value: character });
    else if (character === '^') tokens.push({ type: 'power', value: character });
    else if ('(['.includes(character)) tokens.push({ type: 'open', value: character });
    else if (')]'.includes(character)) tokens.push({ type: 'close', value: character });
    else if (character === ',') tokens.push({ type: 'comma', value: character });
    else throw new Error(`Unsupported character at position ${index + 1}: ${character}`);
    index += 1;
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

function printAst(node) {
  if (node.type === 'number') return node.value;
  if (node.type === 'variable') return node.name;
  if (node.type === 'unary') return `${node.op}${printAst(node.value)}`;
  if (node.type === 'group') return `${node.open}${printAst(node.value)}${node.open === '(' ? ')' : ']'}`;
  if (node.type === 'fraction') return `frac(${printAst(node.numerator)},${printAst(node.denominator)})`;
  if (node.type === 'power') return `${printAst(node.base)}^${printAst(node.exponent)}`;
  if (node.type === 'binary') return `${printAst(node.left)}${COMPARISONS[node.op] ? ` ${node.op} ` : node.implicit ? '' : node.op}${printAst(node.right)}`;
  return '';
}

function mathml(node) {
  if (node.type === 'number') return `<mn>${escapeXml(node.value)}</mn>`;
  if (node.type === 'variable') return `<mi>${node.name}</mi>`;
  if (node.type === 'unary') return `<mrow><mo>${node.op}</mo>${mathml(node.value)}</mrow>`;
  if (node.type === 'group') return `<mrow><mo>${node.open}</mo>${mathml(node.value)}<mo>${node.open === '(' ? ')' : ']'}</mo></mrow>`;
  if (node.type === 'fraction') return `<mfrac>${mathml(node.numerator)}${mathml(node.denominator)}</mfrac>`;
  if (node.type === 'power') return `<msup>${mathml(node.base)}${mathml(node.exponent)}</msup>`;
  if (node.type === 'binary') return `<mrow>${mathml(node.left)}${node.implicit ? '<mo>&#x2062;</mo>' : `<mo>${escapeXml(node.op)}</mo>`}${mathml(node.right)}</mrow>`;
  return '';
}

function speak(node) {
  if (node.type === 'number') return node.value.split('').map(value => value === '.' ? 'point' : value).join(' ');
  if (node.type === 'variable') return node.name;
  if (node.type === 'unary') return `${node.op === '-' ? 'negative' : 'positive'} ${speak(node.value)}`;
  if (node.type === 'group') return `open group ${speak(node.value)} close group`;
  if (node.type === 'fraction') return `fraction numerator ${speak(node.numerator)} denominator ${speak(node.denominator)} end fraction`;
  if (node.type === 'power') return `${speak(node.base)} to the power ${speak(node.exponent)}`;
  if (node.type === 'binary') return `${speak(node.left)} ${spokenOperator(node.op, node.implicit)} ${speak(node.right)}`;
  return '';
}

function spokenOperator(op, implicit) {
  if (implicit) return 'times';
  return ({ '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '=': 'equals', '!=': 'does not equal', '<': 'is less than', '>': 'is greater than', '<=': 'is less than or equal to', '>=': 'is greater than or equal to' })[op];
}

function dotsForCell(cell) {
  if (DOTS_BY_CELL.has(cell)) return DOTS_BY_CELL.get(cell);
  const mask = cell.codePointAt(0) - 0x2800;
  const dots = [1, 2, 3, 4, 5, 6].filter(dot => mask & (1 << (dot - 1)));
  DOTS_BY_CELL.set(cell, dots);
  return dots;
}

function brailleMask(letter) {
  const patterns = { a: 1, b: 3, c: 9, d: 25, e: 17, f: 11, g: 27, h: 19, i: 10, j: 26, k: 5, l: 7, m: 13, n: 29, o: 21, p: 15, q: 31, r: 23, s: 14, t: 30, u: 37, v: 39, w: 58, x: 45, y: 61, z: 53 };
  return patterns[letter];
}

function matchSequence(source, index, values) {
  return Object.entries(values).sort((a, b) => b[1].length - a[1].length).map(([key, value]) => ({ key, value })).find(entry => source.startsWith(entry.value, index));
}
function reverse(value) { return Object.fromEntries(Object.entries(value).map(([key, entry]) => [entry, key])); }
function escapeXml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
