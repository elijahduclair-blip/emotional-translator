import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrailleMath, dotsToUnicode, translateBrailleMath } from '../src/lib/braille-math.js';

const forward = input => translateBrailleMath({ direction: 'print_to_nemeth', inputFormat: 'ascii_math', input });
const reverse = input => translateBrailleMath({ direction: 'nemeth_to_print', inputFormat: 'unicode_braille', input });

test('Nemeth fixtures match verified arithmetic examples', () => {
  assert.equal(forward('3+3+3+3').unicodeBraille, '⠼⠒⠬⠒⠬⠒⠬⠒');
  assert.equal(forward('12-7').unicodeBraille, '⠼⠂⠆⠤⠶');
  assert.equal(forward('3*4 = 12').unicodeBraille, '⠼⠒⠈⠡⠲⠀⠨⠅⠀⠼⠂⠆');
  assert.equal(forward('-5-5 = -10').unicodeBraille, '⠤⠼⠢⠤⠢⠀⠨⠅⠀⠤⠼⠂⠴');
});

test('grouping, fractions, variables, comparisons, and exponents are bounded', () => {
  assert.equal(forward('5-(-4)').unicodeBraille, '⠼⠢⠤⠷⠤⠲⠾');
  assert.equal(forward('frac(3,4)').unicodeBraille, '⠹⠒⠌⠲⠼');
  assert.equal(forward('x^2').unicodeBraille, '⠭⠘⠆');
  assert.equal(forward('2x = 8').unicodeBraille, '⠼⠆⠭⠀⠨⠅⠀⠼⠦');
  assert.equal(forward('2 <= 3').unicodeBraille, '⠼⠆⠀⠐⠅⠱⠀⠼⠒');
});

test('generated subset round trips without semantic authority', () => {
  for (const expression of ['12-7', '-3+5 = 2', '5-(-4)', '2x = 8', 'frac(a+b,c)', 'x^2+2x+1']) {
    const generated = forward(expression);
    const restored = reverse(generated.unicodeBraille);
    assert.equal(restored.normalizedPrint, generated.normalizedPrint);
    assert.equal(restored.boundary.mode, 'notation_only');
    assert.equal(restored.boundary.semanticMutationAllowed, false);
    assert.equal(restored.boundary.colorAssignmentAllowed, false);
  }
});

test('standalone Nemeth can be embedded in UEB context with explicit switches', () => {
  const generated = forward('3+4 = 7');
  assert.equal(generated.uebContextBraille, `⠸⠩⠀${generated.unicodeBraille}⠀⠸⠱`);
  assert.equal(reverse(generated.uebContextBraille).normalizedPrint, '3+4 = 7');
});

test('unsupported input returns 422 and checking does not store answers', () => {
  assert.throws(() => forward('sqrt(4)'), error => error.status === 422 && /Unsupported/.test(error.message));
  assert.throws(() => reverse('⣿'), error => error.status === 422 && /position 1/.test(error.message));
  const result = checkBrailleMath({ direction: 'print_to_nemeth', prompt: '2+2', answer: '⠼⠆⠬⠆' });
  assert.equal(result.correct, true);
  assert.equal('answer' in result, false);
});

test('six-dot input converts deterministically to Unicode Braille', () => {
  assert.equal(dotsToUnicode([1, 2, 3, 4, 5, 6]), '⠿');
  assert.equal(dotsToUnicode([2]), '⠂');
});
