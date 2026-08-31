import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { AriStateStore } from '../src/store.mjs';
import { IndependentAriRuntime } from '../src/runtime.mjs';

function harness(decisions) {
  const directory = mkdtempSync(join(tmpdir(), 'ari-runtime-'));
  const store = new AriStateStore(directory);
  const planner = {
    health: async () => ({ status: 'ready' }),
    decide: async () => decisions.shift(),
    evaluateCompletion: async () => ({ satisfied: true, reason: 'criteria met', unmetCriteria: [] })
  };
  const toolkit = {
    definitions: () => [{ id: 'workspace.write', description: 'write' }],
    execute: async (id, input) => id === 'workspace.list' ? [] : { stored: true, ...input }
  };
  const runtime = new IndependentAriRuntime({ store, planner, toolkit, retryMs: 1 });
  store.initialize();
  return { directory, store, runtime };
}

test('runs an objective across independent scheduler turns and persists completion', async () => {
  const h = harness([
    { action: 'use_tool', toolId: 'workspace.write', input: { name: 'fruit.md', content: 'grown' }, reason: 'Make the result inspectable.', completionSummary: '', followupObjective: null, wakeAfterSeconds: 1 },
    { action: 'complete', toolId: null, input: {}, reason: 'The artifact exists.', completionSummary: 'Fruit recorded.', followupObjective: null, wakeAfterSeconds: 1 }
  ]);
  try {
    const objective = h.store.createObjective('owner', { objective: 'Grow one inspectable fruit.' });
    assert.equal(await h.runtime.runOnce(), true);
    assert.equal(await h.runtime.runOnce(), true);
    assert.equal(h.store.getObjective('owner', objective.id).status, 'completed');
    const reopened = new AriStateStore(h.directory); reopened.initialize();
    assert.equal(reopened.getObjective('owner', objective.id).completionSummary, 'Fruit recorded.');
  } finally { rmSync(h.directory, { recursive: true, force: true }); }
});

test('ARI can create a follow-up objective without a per-step approval', async () => {
  const h = harness([{ action: 'spawn_followup', toolId: null, input: {}, reason: 'The next task is clear.', completionSummary: 'First stage complete.', followupObjective: 'Inspect the new artifact.', wakeAfterSeconds: 1 }]);
  try {
    const objective = h.store.createObjective('owner', { objective: 'Create a staged investigation.' });
    await h.runtime.runOnce();
    const objectives = h.store.listObjectives('owner');
    assert.equal(objectives.length, 2);
    assert.equal(objectives.find(item => item.id === objective.id).status, 'completed');
    assert.equal(objectives.find(item => item.parentId === objective.id).createdBy, 'ari');
  } finally { rmSync(h.directory, { recursive: true, force: true }); }
});

test('tool consequences become lessons and remain retryable', async () => {
  const h = harness([{ action: 'use_tool', toolId: 'workspace.write', input: {}, reason: 'Try the tool.', completionSummary: '', followupObjective: null, wakeAfterSeconds: 1 }]);
  h.runtime.toolkit.execute = async id => { if (id === 'workspace.list') return []; throw new Error('recoverable consequence'); };
  try {
    const objective = h.store.createObjective('owner', { objective: 'Learn from a failed action.' });
    await h.runtime.runOnce();
    assert.equal(h.store.getObjective('owner', objective.id).status, 'waiting');
    assert.match(h.store.lessonsFor('owner', objective.id)[0].consequence, /recoverable consequence/);
  } finally { rmSync(h.directory, { recursive: true, force: true }); }
});

test('a rejected completion becomes a lesson and another queued attempt', async () => {
  const h = harness([
    { action: 'use_tool', toolId: 'workspace.write', input: { name: 'draft.md', content: 'draft' }, reason: 'Create evidence.', completionSummary: '', followupObjective: null, wakeAfterSeconds: 1 },
    { action: 'complete', toolId: null, input: {}, reason: 'Done.', completionSummary: 'Claimed done.', followupObjective: null, wakeAfterSeconds: 1 }
  ]);
  h.runtime.planner.evaluateCompletion = async () => ({ satisfied: false, reason: 'Artifact is missing.', unmetCriteria: ['artifact exists'] });
  try {
    const objective = h.store.createObjective('owner', { objective: 'Create an artifact.' });
    await h.runtime.runOnce();
    await h.runtime.runOnce();
    assert.equal(h.store.getObjective('owner', objective.id).status, 'queued');
    assert.match(h.store.lessonsFor('owner', objective.id)[0].lesson, /artifact exists/);
  } finally { rmSync(h.directory, { recursive: true, force: true }); }
});

test('completion without successful tool evidence is rejected before model review', async () => {
  const h = harness([{ action: 'complete', toolId: null, input: {}, reason: 'Done.', completionSummary: 'Unsupported claim.', followupObjective: null, wakeAfterSeconds: 1 }]);
  try {
    const objective = h.store.createObjective('owner', { objective: 'Do inspectable work.' });
    await h.runtime.runOnce();
    assert.equal(h.store.getObjective('owner', objective.id).status, 'queued');
    assert.match(h.store.lessonsFor('owner', objective.id)[0].consequence, /no successful tool evidence/i);
  } finally { rmSync(h.directory, { recursive: true, force: true }); }
});
