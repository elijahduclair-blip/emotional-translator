import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFoundationText, tokenizeText } from '../src/lib/foundation-analysis.js';

test('foundation tokenization keeps lowercase word units', () => {
  assert.deepEqual(
    tokenizeText('Gold, ritual -- gold!'),
    ['gold', 'ritual', 'gold']
  );
});

test('foundation analysis returns structural counts without meaning', () => {
  const result = analyzeFoundationText('Gold ritual gold ritual icon gold');
  assert.deepEqual(result.stats.totalWords, 6);
  assert.deepEqual(result.stats.distinctWords, 3);
  assert.equal(result.wordCounts[0].word, 'gold');
  assert.equal(result.wordCounts[0].count, 3);
  assert.equal(result.pareto[0].word, 'gold');
  assert.equal(result.coOccurrences[0].count >= 1, true);
  assert.ok(result.patterns.some(item => item.type === 'repeated_word'));
  assert.ok(result.patterns.some(item => item.type === 'repeated_cooccurrence'));
});

test('foundation analysis can widen the co-occurrence window', () => {
  const narrow = analyzeFoundationText('gold sacred ritual icon', { windowSize: 2 });
  const wide = analyzeFoundationText('gold sacred ritual icon', { windowSize: 4 });
  const narrowHasGoldIcon = narrow.coOccurrences.some(item => item.word === 'gold' && item.related === 'icon');
  const wideHasGoldIcon = wide.coOccurrences.some(item => item.word === 'gold' && item.related === 'icon');
  assert.equal(narrowHasGoldIcon, false);
  assert.equal(wideHasGoldIcon, true);
});
