const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, evaluateNotation } = require('../src');

test('evaluation remains a proposal and traces natural climate cues', () => {
  const result = evaluate({
    text: 'Ember motion beside silver revision',
    userId: 'test-user'
  });

  assert.equal(result.status, 'proposed');
  assert.equal(result.boundary.semanticMutationAllowed, false);
  assert.deepEqual(result.climateSignals.map(signal => signal.family), ['ember', 'silver']);
  assert.equal(result.evidence.observation, 'Ember motion beside silver revision');
  assert.equal(result.translation.climateName, 'Ember beside Silver');
  assert.match(result.translation.relationalRead, /coexist/i);
});

test('notation evaluation preserves the Braille boundary without semantic authority', () => {
  const result = evaluateNotation({ notation: '2x = 8' });
  assert.equal(result.boundary.mode, 'notation_only');
  assert.equal(result.boundary.semanticMutationAllowed, false);
  assert.equal(result.boundary.colorAssignmentAllowed, false);
  assert.equal(result.boundary.graphMutationAllowed, false);
  assert.equal(result.boundary.mathematicalTruthAssessed, false);
});

test('notation evaluation supports the expanded conversation-to-Braille budget', () => {
  const expanded = evaluateNotation({ notation: '⠁'.repeat(513) });
  assert.equal([...expanded.notation].length, 513);
  assert.throws(
    () => evaluateNotation({ notation: '⠁'.repeat(20_001) }),
    /at most 20000 Unicode code points/
  );
});

test('evaluation rejects empty observations', () => {
  assert.throws(() => evaluate({ text: ' ' }), /non-empty text/);
});

test('evaluation keeps unmatched language unresolved', () => {
  const result = evaluate({ text: 'Something is changing, but I do not have a name for it.' });
  assert.equal(result.translation.climateName, 'Unresolved climate');
  assert.equal(result.translation.primaryClimate, null);
  assert.match(result.translation.relationalRead, /open atmosphere/i);
});
