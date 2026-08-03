import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeLetterAccountability,
  buildWordSignature,
  codePointToStructuralCells,
  compareLetterPatterns,
  structuralCellsToCodePoint
} from '../src/lib/letter-accountability.js';

test('ordered comparison accounts for substitutions without averaging', () => {
  const changed = compareLetterPatterns('CAT', 'BAT');
  assert.deepEqual(changed.differences, [{
    operation: 'substitution', leftPosition: 1, rightPosition: 1, left: 'c', right: 'b'
  }]);
  const reordered = compareLetterPatterns('CAT', 'ACT');
  assert.equal(reordered.identical, false);
  assert.equal(reordered.differenceCount, 2);
});

test('letter signatures retain ordered positions and repeated-letter positions', () => {
  const signature = buildWordSignature('letter', 'w1');
  assert.deepEqual(signature.letters.map(letter => letter.normalized), ['l', 'e', 't', 't', 'e', 'r']);
  assert.deepEqual(signature.letterFrequencies.find(item => item.letter === 't'), { letter: 't', count: 2, positions: [3, 4] });
  assert.deepEqual(signature.letterFrequencies.find(item => item.letter === 'e'), { letter: 'e', count: 2, positions: [2, 5] });
});

test('repeated occurrences reuse a signature while preserving surface and sequence', () => {
  const result = analyzeLetterAccountability("CAT, cat — can't 2026");
  assert.equal(result.signatures.length, 2);
  assert.deepEqual(result.wordSequence.map(item => item.signatureId), ['w1', 'w1', 'w2']);
  assert.deepEqual(result.wordSequence.map(item => item.surface), ['CAT', 'cat', "can't"]);
  assert.ok(result.nonWordSegments.some(segment => segment.value.includes(',')));
  assert.ok(result.nonWordSegments.some(segment => segment.value === '2026'));
  assert.deepEqual(result.signatures[1].nonLetterMarks, [{ surfacePosition: 4, value: "'" }]);
});

test('NFC normalization unifies composed and decomposed words', () => {
  const result = analyzeLetterAccountability('café cafe\u0301');
  assert.equal(result.signatures.length, 1);
  assert.equal(result.signatures[0].normalizedWord, 'café');
  assert.deepEqual(result.wordSequence.map(item => item.signatureId), ['w1', 'w1']);
});

test('Unicode code points reversibly use four non-Braille six-bit cells', () => {
  const signature = buildWordSignature('𐐀λ', 'unicode');
  for (const letter of signature.letters) {
    for (let index = 0; index < letter.codePoints.length; index += 1) {
      const cells = letter.structuralCells.slice(index * 4, index * 4 + 4);
      assert.equal(cells.length, 4);
      assert.equal(structuralCellsToCodePoint(cells), letter.codePoints[index]);
    }
  }
  assert.deepEqual(codePointToStructuralCells('A'.codePointAt(0)).map(cell => cell.bits), ['000000', '000000', '000001', '000001']);
});

test('unequal words produce deterministic insertions and deletions', () => {
  const insertion = compareLetterPatterns('cat', 'cart');
  assert.ok(insertion.differences.some(item => item.operation === 'insertion' && item.right === 'r'));
  const deletion = compareLetterPatterns('plane', 'pane');
  assert.ok(deletion.differences.some(item => item.operation === 'deletion' && item.left === 'l'));
});

test('accountability boundary cannot mutate semantics, color, graph, or Braille', () => {
  const result = analyzeLetterAccountability('ember');
  assert.equal(result.boundary.mode, 'structure_only');
  assert.equal(result.boundary.semanticMutationAllowed, false);
  assert.equal(result.boundary.colorAssignmentAllowed, false);
  assert.equal(result.boundary.graphMutationAllowed, false);
  assert.equal(result.boundary.brailleMeaningInherited, false);
});
