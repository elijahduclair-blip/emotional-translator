import test from 'node:test';
import assert from 'node:assert/strict';
import { runStructuralLanguageLoop } from '../src/lib/language-loop.js';
import { transcribeEnglishToUeb, transcribeUebToEnglish } from '../src/lib/braille-runtime-language.js';

test('English round trips through visible UEB, binary cells, and numbers', () => {
  const result = runStructuralLanguageLoop('CAT, cat 3.5!');
  assert.equal(result.decoding.english, 'CAT, cat 3.5!');
  assert.equal(result.decoding.roundTripExact, true);
  assert.deepEqual(result.encoding.numericSequence.slice(0, 4), [32, 9, 32, 1]);
  assert.equal(result.encoding.binarySequence[1], '001001');
  assert.equal(result.encoding.cells.length, result.encoding.numericSequence.length);
  assert.equal(result.processing.transitions.length, result.encoding.cells.length - 1);
  assert.equal(result.boundary.encodingCreatesMeaning, false);
});

test('ordered letter changes remain visible in the machine sequence', () => {
  const cat = runStructuralLanguageLoop('CAT');
  const bat = runStructuralLanguageLoop('BAT');
  assert.deepEqual(cat.encoding.numericSequence, [32, 9, 32, 1, 32, 30]);
  assert.deepEqual(bat.encoding.numericSequence, [32, 3, 32, 1, 32, 30]);
  assert.notDeepEqual(cat.encoding.numericSequence, bat.encoding.numericSequence);
});

test('Qwen quotation marks remain reversible instead of blocking ARI cultivation', () => {
  const plain = runStructuralLanguageLoop('ARI said, "*What is moving?*"');
  assert.equal(plain.decoding.english, 'ARI said, "*What is moving?*"');
  assert.equal(plain.decoding.roundTripExact, true);

  const directional = '“Climate,” and ‘relation.’';
  assert.equal(transcribeUebToEnglish(transcribeEnglishToUeb(directional)), directional);
});

test('the language loop accepts expanded conversations and rejects more than 10000 code points', () => {
  const expanded = runStructuralLanguageLoop('a'.repeat(2_001));
  assert.equal(expanded.originalEnglish.length, 2_001);
  assert.throws(
    () => runStructuralLanguageLoop('a'.repeat(10_001)),
    error => error.status === 413 && /10000 Unicode code points/.test(error.message)
  );
});

test('the bounded decoder rejects unsupported cells rather than inventing English', () => {
  const ueb = transcribeEnglishToUeb('Gold memory.');
  assert.equal(transcribeUebToEnglish(ueb), 'Gold memory.');
  assert.throws(() => transcribeUebToEnglish('⣿'), error => error.status === 422);
  assert.throws(() => runStructuralLanguageLoop('English 🚀'), error => error.status === 422);
});
