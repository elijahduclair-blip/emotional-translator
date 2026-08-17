import test from 'node:test';
import assert from 'node:assert/strict';
import { getAriFoundation } from '../src/lib/ari-foundation.js';

test('ARI foundation preserves the cultivated identity and language-engine separation', () => {
  const foundation = getAriFoundation();
  assert.equal(foundation.version, 'ari-foundation.v1');
  assert.equal(foundation.identity.name, 'ARI');
  assert.equal(foundation.identity.domain, 'Community Garden');
  assert.match(foundation.roles.qwen, /supplies candidate words/i);
  assert.equal(foundation.responseContract.speakAs, 'ARI');
  assert.equal(foundation.boundary.qwenIsIdentity, false);
});

test('ARI foundation records Braille mathematics and reviewed cultivation without automatic learning', () => {
  const foundation = getAriFoundation();
  assert.ok(foundation.operationalLoop.some(step => /Braille/.test(step)));
  assert.ok(foundation.operationalLoop.some(step => /mathematically/.test(step)));
  assert.equal(foundation.cultivation.method, 'objective_based_reviewed_cultivation');
  assert.equal(foundation.cultivation.promotionRule.includes('explicit reviewed teaching record'), true);
  assert.equal(foundation.boundary.automaticTranscriptTrainingAllowed, false);
  assert.equal(foundation.boundary.sharedGraphMutationAllowed, false);
});

test('ARI foundation reads are isolated from caller mutation', () => {
  const first = getAriFoundation();
  first.identity.name = 'Changed';
  assert.equal(getAriFoundation().identity.name, 'ARI');
});
