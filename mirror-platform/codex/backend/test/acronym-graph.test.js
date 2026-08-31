import test from 'node:test';
import assert from 'node:assert/strict';
import { expandAcronymGraph } from '../src/lib/acronym-graph.js';

test('BRIGDE uses the founding cultivator authoritative acronym order', () => {
  const result = expandAcronymGraph({ roots: ['BRIGDE'] });
  const root = result.nodes.find(node => node.normalizedWord === 'brigde');

  assert.deepEqual(root.slots.map(slot => slot.term), [
    'Buildable', 'Reusable', 'Independent', 'Grouped', 'Dots', 'Enterconnected'
  ]);
  assert.equal(result.edges.length, 6);
  assert.equal(result.degreeOfVision.permanentDepthLimit, null);
  assert.equal(result.growth.openEnded, true);
  assert.equal(result.growth.terminal, false);
});

test('every discovered word remains an open acronym when it has no definition', () => {
  const result = expandAcronymGraph({ roots: ['CAT'] });
  assert.equal(result.nodes[0].isAcronym, true);
  assert.deepEqual(result.nodes[0].slots.map(slot => slot.letter.toLowerCase()), ['c', 'a', 't']);
  assert.deepEqual(result.frontier.awaitingDefinitions, ['CAT']);
  assert.equal(result.continuation.available, true);
});

test('a continuation resumes the preserved frontier after another definition is supplied', () => {
  const first = expandAcronymGraph({ roots: ['CAT'] });
  const second = expandAcronymGraph({
    continuation: first.continuation,
    definitions: { CAT: ['Connected', 'Accountable', 'Traceable'] }
  });

  assert.equal(second.nodes.find(node => node.normalizedWord === 'cat').expansionStatus, 'expanded_in_view');
  assert.deepEqual(second.edges.map(edge => edge.position), [1, 2, 3]);
  assert.deepEqual(second.frontier.awaitingDefinitions.sort(), ['Accountable', 'Connected', 'Traceable'].sort());
});

test('degree of vision bounds a view without creating a permanent depth limit', () => {
  const result = expandAcronymGraph({
    roots: ['CAT'],
    definitions: { CAT: ['Connected', 'Accountable', 'Traceable'] },
    degreeOfVision: { maxNodes: 2, maxEdges: 2 }
  });

  assert.equal(result.edges.length, 0);
  assert.deepEqual(result.frontier.deferredByDegreeOfVision, ['CAT']);
  assert.equal(result.continuation.available, true);
  assert.equal(result.degreeOfVision.permanentDepthLimit, null);
});

test('cycles become reusable connections instead of infinite duplicated nodes', () => {
  const result = expandAcronymGraph({
    roots: ['A'],
    definitions: { A: ['A'] }
  });

  assert.equal(result.nodes.length, 1);
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].closesCycle, true);
  assert.equal(result.continuation.available, false);
  assert.equal(result.growth.terminal, false);
});

test('acronym definitions require one initial-matched term for every letter position', () => {
  assert.throws(
    () => expandAcronymGraph({ roots: ['CAT'], definitions: { CAT: ['Connected', 'Wrong', 'Traceable'] } }),
    error => error.status === 422 && /position 2/.test(error.message)
  );
});

test('acronym expansion remains structural and cannot mutate meaning or either graph', () => {
  const result = expandAcronymGraph({ roots: ['CAT'] });
  assert.equal(result.boundary.expansionCreatesMeaning, false);
  assert.equal(result.boundary.semanticMutationAllowed, false);
  assert.equal(result.boundary.graphMutationAllowed, false);
  assert.equal(result.boundary.colorAssignmentAllowed, false);
});
