import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResearchItem, parseSources, stripHtml } from '../src/routes/research.js';

test('research sources default to the two curated providers', () => {
  assert.deepEqual([...parseSources()].sort(), ['crossref', 'wikipedia']);
});

test('unsupported research sources do not become fetch targets', () => {
  assert.deepEqual([...parseSources('wikipedia,example')], ['wikipedia']);
  assert.throws(() => parseSources('example'), /Choose Wikipedia, Crossref, or both/);
});

test('research evidence requires HTTPS, a boundary, and a counterexample', () => {
  const base = {
    query: 'winter ritual',
    title: 'Winter ritual',
    sourceName: 'Example source',
    sourceType: 'scholarly_metadata',
    sourceUrl: 'https://example.com/evidence',
    boundary: 'Context only.',
    counterexample: 'The pattern does not recur outside this setting.',
    confidence: 'medium'
  };
  assert.equal(normalizeResearchItem(base).sourceUrl, 'https://example.com/evidence');
  assert.throws(() => normalizeResearchItem({ ...base, sourceUrl: 'http://example.com' }), /HTTPS/);
  assert.throws(() => normalizeResearchItem({ ...base, counterexample: '' }), /counterexample/i);
});

test('source excerpts are stripped to plain compact text', () => {
  assert.equal(stripHtml('<p>Light <b>through</b> glass.</p>'), 'Light through glass.');
});
