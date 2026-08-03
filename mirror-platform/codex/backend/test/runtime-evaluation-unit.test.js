import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmotionalTranslation, normalizeRuntimeEvaluation } from '../src/routes/runtime.js';

test('runtime evaluation accepts proposal-only observations', () => {
  const normalized = normalizeRuntimeEvaluation({
    id: 'evaluation-1',
    kind: 'evaluated_observation',
    status: 'proposed',
    userId: 'user-1',
    input: 'Ember motion beside silver revision',
    fingerprint: 'abc123',
    climateSignals: [{ family: 'ember', cues: ['ember', 'motion'] }],
    evidence: { source: 'mirror_runtime_user_input' },
    boundary: {
      mode: 'proposal_only',
      semanticMutationAllowed: false
    }
  });

  assert.equal(normalized.input, 'Ember motion beside silver revision');
  assert.equal(normalized.boundary.semanticMutationAllowed, false);
});

test('runtime evaluation rejects semantic mutation authority', () => {
  assert.throws(
    () => normalizeRuntimeEvaluation({
      id: 'evaluation-2',
      kind: 'evaluated_observation',
      status: 'proposed',
      input: 'An observation',
      fingerprint: 'def456',
      boundary: {
        mode: 'authorized_commit',
        semanticMutationAllowed: true
      }
    }),
    /proposal-only semantic boundary/
  );
});

test('emotional translation preserves its evidence source', () => {
  const normalized = normalizeEmotionalTranslation({
    source: 'codex_graph',
    climateName: 'Midnight · midnight',
    relationalRead: 'The graph lands in a midnight climate.',
    matchedNodes: [{ id: 'midnight' }],
    supportedRoutes: []
  });

  assert.equal(normalized.source, 'codex_graph');
  assert.equal(normalized.matchedNodes.length, 1);
});
