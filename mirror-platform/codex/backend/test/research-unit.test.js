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

test('research intake cannot smuggle approval or graph mutation state into a candidate', () => {
  const item = normalizeResearchItem({
    query: 'color atmosphere',
    title: 'Color atmosphere',
    sourceName: 'Example source',
    sourceType: 'scholarly_metadata',
    sourceUrl: 'https://example.com/evidence',
    boundary: 'Evidence lead only.',
    counterexample: 'Reject when the source does not address the claimed context.',
    confidence: 'low',
    status: 'approved',
    graphProposalId: 'proposal-smuggled',
    semanticMutationAllowed: true
  });

  assert.equal('status' in item, false);
  assert.equal('graphProposalId' in item, false);
  assert.equal('semanticMutationAllowed' in item, false);
});

test('history index research records require lane, era, type, summary, and route seeds', () => {
  const item = normalizeResearchItem({
    query: 'byzantine iconography',
    title: 'Byzantine art',
    kind: 'history_index',
    sourceName: 'Wikipedia',
    sourceType: 'encyclopedic',
    sourceUrl: 'https://en.wikipedia.org/wiki/Byzantine_art',
    boundary: 'History context only.',
    counterexample: 'If no devotional image, liturgical, or icon route is present.',
    confidence: 'medium',
    historyMetadata: {
      eraId: 'medieval-post-classical',
      lane: 'arts',
      type: 'art movement',
      summary: 'Sacred image and devotional visibility.',
      routeSeeds: ['icon', 'gold', 'devotion']
    }
  });
  assert.equal(item.kind, 'history_index');
  assert.equal(item.historyMetadata.lane, 'arts');
  assert.deepEqual(item.historyMetadata.routeSeeds, ['icon', 'gold', 'devotion']);
  assert.throws(() => normalizeResearchItem({
    query: 'x',
    title: 'x',
    kind: 'history_index',
    sourceName: 'Wikipedia',
    sourceType: 'encyclopedic',
    sourceUrl: 'https://example.com/x',
    boundary: 'History context only.',
    counterexample: 'Counterexample.',
    confidence: 'low',
    historyMetadata: { lane: 'arts', type: 'movement', summary: 'Missing era and route seeds.' }
  }), /era/i);
});

test('source excerpts are stripped to plain compact text', () => {
  assert.equal(stripHtml('<p>Light <b>through</b> glass.</p>'), 'Light through glass.');
});
