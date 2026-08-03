import test from 'node:test';
import assert from 'node:assert/strict';
import { inputTerms, nodeMatchesTerms } from '../src/routes/translate.js';

test('graph-read matching does not expand a token into an unrelated substring', () => {
  const terms = inputTerms('did you get');

  assert.equal(nodeMatchesTerms({ label: 'young' }, terms), false);
  assert.equal(nodeMatchesTerms({ label: 'you' }, terms), true);
});

test('graph-read matching includes normalized two and three word phrases', () => {
  const terms = inputTerms('I feel Amber Glow beside uncertainty');

  assert.ok(terms.includes('amber glow'));
  assert.ok(terms.includes('amber glow beside'));
  assert.equal(nodeMatchesTerms({ label: 'Amber Glow' }, terms), true);
});

test('graph-read matching accepts exact aliases without partial matches', () => {
  const terms = inputTerms('midnight reflection');

  assert.equal(nodeMatchesTerms({ label: 'Ocean', metadata: { aliases: ['midnight'] } }, terms), true);
  assert.equal(nodeMatchesTerms({ label: 'Ocean', metadata: { aliases: ['midnight blue'] } }, ['night']), false);
});
