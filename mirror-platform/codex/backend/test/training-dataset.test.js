import test from 'node:test';
import assert from 'node:assert/strict';
import { runStructuralLanguageLoop } from '../src/lib/language-loop.js';
import {
  BRAILLE_TOKEN_VOCABULARY,
  buildVerifiedTrainingDataset,
  normalizeTrainingInputs
} from '../src/lib/training-dataset.js';

const unresolvedMeaning = {
  approvedGraph: { sourceLayer: 'unresolved', nodes: [], routes: [] },
  wordNet: { matchedWords: [], unresolvedWords: ['cat'] }
};

test('training generator creates four deterministic verified tasks per English source', () => {
  const loop = runStructuralLanguageLoop('CAT');
  const first = buildVerifiedTrainingDataset([{ loop, meaning: unresolvedMeaning }]);
  const second = buildVerifiedTrainingDataset([{ loop, meaning: unresolvedMeaning }]);

  assert.equal(first.sourceCount, 1);
  assert.equal(first.recordCount, 4);
  assert.equal(first.validation.valid, true);
  assert.equal(first.validation.samples[0].cellAlignmentExact, true);
  assert.deepEqual(first.records.map(record => record.task), [
    'english_to_structural',
    'structural_to_english',
    'ordered_foundation',
    'relational_grounding'
  ]);
  const encoded = JSON.parse(first.records[0].messages[2].content);
  assert.deepEqual(encoded.numbers, [32, 9, 32, 1, 32, 30]);
  assert.deepEqual(encoded.tokens, ['<B32>', '<B09>', '<B32>', '<B01>', '<B32>', '<B30>']);
  assert.deepEqual(first.records.map(record => record.id), second.records.map(record => record.id));
  assert.equal(first.boundary.modelWeightsChanged, false);
});

test('six-dot vocabulary accounts for every possible Braille mask exactly once', () => {
  assert.equal(BRAILLE_TOKEN_VOCABULARY.length, 64);
  assert.deepEqual(BRAILLE_TOKEN_VOCABULARY[0], {
    token: '<B00>', mask: 0, bits: '000000', unicode: '⠀', dots: []
  });
  assert.equal(BRAILLE_TOKEN_VOCABULARY[63].token, '<B63>');
  assert.equal(BRAILLE_TOKEN_VOCABULARY[63].bits, '111111');
  assert.deepEqual(BRAILLE_TOKEN_VOCABULARY[63].dots, [1, 2, 3, 4, 5, 6]);
});

test('training inputs are bounded, normalized, and deduplicated by first occurrence', () => {
  assert.deepEqual(normalizeTrainingInputs(['  café  ', 'cafe\u0301', 'CAT']), ['café', 'CAT']);
  assert.throws(() => normalizeTrainingInputs([]), error => error.status === 400);
  assert.throws(() => normalizeTrainingInputs(['CAT', { text: 'BAT' }]), error => error.status === 400);
  assert.throws(() => normalizeTrainingInputs(Array.from({ length: 13 }, (_, index) => `word ${index}`)), error => error.status === 413);
});

test('training generator rejects a misaligned signal instead of creating a false lesson', () => {
  const loop = runStructuralLanguageLoop('CAT');
  loop.encoding.numericSequence[0] = 1;
  assert.throws(
    () => buildVerifiedTrainingDataset([{ loop, meaning: unresolvedMeaning }]),
    error => error.status === 422
  );
});
