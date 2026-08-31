import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARI_AUTONOMY_SAFE_TOOLS,
  autonomyBoundary,
  normalizeAutonomyObjective,
  normalizeAutonomyOutcome,
  normalizeAutonomyStep
} from '../src/lib/ari-autonomy.js';

test('normalizes an owner-authorized objective without granting mutation tools', () => {
  const objective = normalizeAutonomyObjective({
    objective: 'Understand why recommendations repeat and identify a better conversational approach.',
    successCriteria: ['Consult ordered context', 'Return an accountable conclusion'],
    maxSteps: 6
  });
  assert.equal(objective.maxSteps, 6);
  assert.deepEqual(objective.allowedTools, ARI_AUTONOMY_SAFE_TOOLS);
  assert.equal(objective.allowedTools.some(tool => /place|append|write|mutat/i.test(tool)), false);
  assert.equal(autonomyBoundary().perStepApprovalRequired, false);
  assert.equal(autonomyBoundary().permissionExpansionAllowed, false);
  assert.equal(autonomyBoundary().mistakesAllowed, true);
  assert.equal(autonomyBoundary().mistakesAutomaticallyReduceAuthority, false);
});

test('rejects an objective that attempts to authorize a personal graph write', () => {
  assert.throws(() => normalizeAutonomyObjective({
    objective: 'Rewrite my graph automatically.',
    allowedTools: ['mira.read-private-context', 'cara.place-personal-relationship']
  }), /outside ARI's autonomous jurisdiction/);
});

test('stores a content-free tool receipt and removes requested writes', () => {
  const step = normalizeAutonomyStep({
    sequence: 1,
    action: 'use_tool',
    toolId: 'mira.read-private-context',
    status: 'completed',
    reason: 'Context is needed.',
    objectiveStatus: 'active',
    observation: { sourceLayer: 'private_transcript', summary: '24 events read.', itemCount: 24 },
    receipt: {
      version: 'ari-tool-receipt.v1', id: 'receipt-1', taskId: 'task-1', toolId: 'mira.read-private-context',
      teamMember: 'MIRA', status: 'completed', objective: 'Read context', durationMs: 4,
      access: { readScopes: ['private_transcript'], writeScopes: ['shared_graph'], authenticatedAccountUsed: true },
      privateInput: 'these words must not survive normalization'
    }
  });
  assert.deepEqual(step.receipt.access.writeScopes, []);
  assert.equal(JSON.stringify(step).includes('these words must not survive'), false);
});

test('normalizes an accountable consequence into a reusable lesson', () => {
  const outcome = normalizeAutonomyOutcome({
    stepSequence: 2,
    classification: 'mistake',
    consequence: 'The answer repeated the previous recommendation.',
    lesson: 'Treat a request for another option as a request for a different title.',
    nextAttempt: 'Compare the proposed title with prior recommendations before answering.',
    reversible: true
  });
  assert.equal(outcome.classification, 'mistake');
  assert.equal(outcome.stepSequence, 2);
  assert.match(outcome.lesson, /different title/);
  assert.equal(outcome.reversible, true);
});
