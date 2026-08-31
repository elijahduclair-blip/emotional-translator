import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIGDE_FOUNDATION_ACRONYM,
  buildBridgeStructure
} from '../src/lib/bridge-foundation.js';

test('BRIGDE names the construction rule in its authoritative order', () => {
  assert.equal(BRIGDE_FOUNDATION_ACRONYM.map(item => item.letter).join(''), 'BRIGDE');
  assert.deepEqual(BRIGDE_FOUNDATION_ACRONYM.map(item => item.word), [
    'Buildable', 'Reusable', 'Independent', 'Grouped', 'Dots', 'Enterconnected'
  ]);
});

test('BRIGDE reuses groups and connects ordered occurrences without merging identities', () => {
  const result = buildBridgeStructure('CAT cat BAT');

  assert.equal(result.version, 'brigde-foundation.v2');
  assert.equal(result.name, 'BRIGDE');
  assert.equal(result.counts.groups, 2);
  assert.equal(result.counts.occurrences, 3);
  assert.equal(result.counts.bridges, 2);
  assert.equal(result.counts.reusableGroups, 1);
  assert.deepEqual(result.occurrences.map(item => item.groupId), ['w1', 'w1', 'w2']);
  assert.deepEqual(result.groups[0].occurrenceReferences, [1, 2]);
  assert.equal(result.groups[0].reusable, true);
  assert.deepEqual(result.bridges.map(item => [item.fromOccurrenceId, item.toOccurrenceId]), [['o1', 'o2'], ['o2', 'o3']]);
  assert.equal(result.groups.every(group => group.cells.every(cell => /^[01]{6}$/.test(cell.bits))), true);
  assert.equal(result.counts.dots, result.counts.cells * 6);
});

test('BRIGDE remains structural and grants no graph or semantic mutation authority', () => {
  const result = buildBridgeStructure('ember bridge');
  assert.equal(result.boundary.mode, 'structure_only');
  assert.equal(result.boundary.bridgeCreatesMeaning, false);
  assert.equal(result.boundary.semanticMutationAllowed, false);
  assert.equal(result.boundary.colorAssignmentAllowed, false);
  assert.equal(result.boundary.graphMutationAllowed, false);
  assert.equal(result.boundary.sourceMutationAllowed, false);
});
