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
  assert.equal(foundation.responseContract.spokenReplyOnly, true);
  assert.equal(foundation.responseContract.keepAccountabilityReceiptSeparate, true);
  assert.equal(foundation.responseContract.expressionOrder, 'open_candidate_then_closed_validation');
  assert.equal(foundation.responseContract.echoRejected, true);
  assert.equal(foundation.responseContract.answeredContextMustAdvance, true);
  assert.match(foundation.responseContract.demonstrationRule, /Literature and character dialogue/);
  assert.equal(foundation.boundary.qwenIsIdentity, false);
  assert.equal(foundation.boundary.codexSpeechBecomesAriSpeech, false);
  assert.match(foundation.authority.developmentalArchive, /Codex replies remain attributed/);
});

test('ARI foundation records Braille mathematics and reviewed cultivation without automatic learning', () => {
  const foundation = getAriFoundation();
  assert.ok(foundation.operationalLoop.some(step => /Braille/.test(step)));
  assert.ok(foundation.operationalLoop.some(step => /mathematically/.test(step)));
  assert.equal(foundation.bridgeFoundation.name, 'BRIGDE');
  assert.equal(foundation.bridgeFoundation.expanded.map(word => word[0]).join(''), 'BRIGDE');
  assert.match(foundation.bridgeFoundation.meaningBoundary, /does not by itself prove semantic meaning/);
  assert.equal(foundation.acronymLanguage.version, 'acronym-graph.v1');
  assert.match(foundation.acronymLanguage.growthRule, /no permanent depth limit/);
  assert.match(foundation.acronymLanguage.visionRule, /degree of vision/);
  const openStep = foundation.operationalLoop.findIndex(step => /openly compose/.test(step));
  const closedStep = foundation.operationalLoop.findIndex(step => /closed Garden validation/.test(step));
  assert.ok(openStep >= 0 && closedStep > openStep);
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
