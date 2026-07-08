import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_REFERENCE, limitAiRequests, normalizeTerms } from '../src/routes/ai.js';
import { analyzeSelectionClimate, normalizeSelections } from '../src/lib/selection-climate.js';

test('AI reference preserves the framework boundary', () => {
  assert.match(AI_REFERENCE.universalBoundary, /not diagnosis/i);
  assert.match(AI_REFERENCE.formulas.themeRead, /source \+ filter/);
  assert.match(AI_REFERENCE.formulas.selectionRead, /selection set/i);
  assert.match(AI_REFERENCE.formulas.patternExtraction, /extracted attributes/i);
});

test('AI context terms preserve the phrase and useful component words', () => {
  assert.deepEqual(normalizeTerms('Scared but Hopeful!'), ['scared but hopeful', 'scared', 'but', 'hopeful']);
});

test('AI rate limiter permits an ordinary request', () => {
  let continued = false;
  limitAiRequests({ ip: 'unit-test-client' }, { setHeader() {} }, error => {
    assert.equal(error, undefined);
    continued = true;
  });
  assert.equal(continued, true);
});

test('selection climate normalizes pasted lists', () => {
  assert.deepEqual(
    normalizeSelections({ text: 'Teal Green, Blue Sapphire + Evergreen\nIrregular Quad' }),
    ['teal green', 'blue sapphire', 'evergreen', 'irregular quad']
  );
});

test('selection climate separates observation from inference', () => {
  const result = analyzeSelectionClimate({
    selections: ['Teal Green', 'Blue Sapphire', 'Evergreen', 'Red Mahogany', 'Sand Yellow', 'Irregular Quadrilateral']
  });
  assert.equal(result.unresolved, false);
  assert.match(result.systemName, /Pattern Extraction System/i);
  assert.ok(result.extractedAttributes.length >= 4);
  assert.match(result.observablePatterns.join(' '), /deeper shades/i);
  assert.match(result.inferredPreferences.join(' '), /depth > visibility/i);
  assert.match(result.finalRead, /Depth is preferred over spectacle/i);
  assert.equal(result.connectionStrength, 'strong');
});
