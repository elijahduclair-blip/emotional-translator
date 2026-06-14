import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_REFERENCE, limitAiRequests, normalizeTerms } from '../src/routes/ai.js';

test('AI reference preserves the framework boundary', () => {
  assert.match(AI_REFERENCE.universalBoundary, /not diagnosis/i);
  assert.match(AI_REFERENCE.formulas.themeRead, /source \+ filter/);
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
