import { analyzeLetterAccountability } from './letter-accountability.js';

export const BRIGDE_FOUNDATION_VERSION = 'brigde-foundation.v2';
export const BRIGDE_FOUNDATION_ACRONYM = Object.freeze([
  Object.freeze({ letter: 'B', word: 'Buildable', rule: 'Groups and bridges may be composed into a larger structure.' }),
  Object.freeze({ letter: 'R', word: 'Reusable', rule: 'A normalized group is defined once and referenced by every ordered occurrence.' }),
  Object.freeze({ letter: 'I', word: 'Independent', rule: 'Every dot keeps its own position and binary state inside a cell.' }),
  Object.freeze({ letter: 'G', word: 'Grouped', rule: 'Cells, letters, and words form nested ordered groups without losing their parts.' }),
  Object.freeze({ letter: 'D', word: 'Dots', rule: 'Six ordered binary positions form the smallest visible structural frame.' }),
  Object.freeze({ letter: 'E', word: 'Enterconnected', rule: 'An ordered bridge connects occurrences while preserving both endpoint identities.' })
]);

export const BRIGDE_FOUNDATION_BOUNDARY = Object.freeze({
  mode: 'structure_only',
  relationshipType: 'ordered_adjacency',
  bridgeCreatesMeaning: false,
  semanticMutationAllowed: false,
  colorAssignmentAllowed: false,
  graphMutationAllowed: false,
  sourceMutationAllowed: false,
  reason: 'BRIGDE records reusable structural groups and ordered connections. A structural bridge is not semantic evidence and does not mutate the personal or shared graph.'
});

export function buildBrigdeStructure(text) {
  const input = String(text || '');
  if (!input.trim()) throw httpError(400, 'text parameter required');

  const accountability = analyzeLetterAccountability(input);
  if (!accountability.wordSequence.length) throw httpError(422, 'BRIGDE requires at least one word containing a Unicode letter.');

  const occurrencesByGroup = new Map();
  for (const occurrence of accountability.wordSequence) {
    const entries = occurrencesByGroup.get(occurrence.signatureId) || [];
    entries.push(occurrence.occurrence);
    occurrencesByGroup.set(occurrence.signatureId, entries);
  }

  const groups = accountability.signatures.map(signature => {
    const occurrences = occurrencesByGroup.get(signature.id) || [];
    const cells = signature.letters.flatMap(letter => letter.structuralCells.map(cell => ({
      id: `${signature.id}.l${letter.position}.c${cell.index}`,
      letterPosition: letter.position,
      letter: letter.normalized,
      cellIndex: cell.index,
      bits: cell.bits,
      value: cell.value,
      activePositions: [...cell.activePositions]
    })));
    return {
      id: signature.id,
      kind: 'ordered_word_pattern',
      normalizedWord: signature.normalizedWord,
      reusable: occurrences.length > 1,
      occurrenceReferences: occurrences,
      letterCount: signature.letterCount,
      cellCount: cells.length,
      dotCount: cells.length * 6,
      activeDotCount: cells.reduce((sum, cell) => sum + cell.activePositions.length, 0),
      cells
    };
  });

  const occurrences = accountability.wordSequence.map(item => ({
    id: `o${item.occurrence}`,
    position: item.occurrence,
    groupId: item.signatureId,
    surface: item.surface,
    start: item.start,
    end: item.end
  }));

  const bridges = occurrences.slice(1).map((to, index) => {
    const from = occurrences[index];
    return {
      id: `b${index + 1}`,
      fromOccurrenceId: from.id,
      toOccurrenceId: to.id,
      fromGroupId: from.groupId,
      toGroupId: to.groupId,
      relationship: 'ordered_adjacency',
      directed: true,
      distance: 1
    };
  });

  return {
    version: BRIGDE_FOUNDATION_VERSION,
    engine: 'foundation_brigde',
    name: 'BRIGDE',
    acronym: BRIGDE_FOUNDATION_ACRONYM,
    principle: 'Independent dots become reusable ordered groups. Traceable bridges connect group occurrences without collapsing their identities.',
    dotFrame: {
      positions: [1, 2, 3, 4, 5, 6],
      states: [0, 1],
      independent: true,
      positionCreatesMeaning: false
    },
    counts: {
      groups: groups.length,
      occurrences: occurrences.length,
      bridges: bridges.length,
      reusableGroups: groups.filter(group => group.reusable).length,
      cells: groups.reduce((sum, group) => sum + group.cellCount, 0),
      dots: groups.reduce((sum, group) => sum + group.dotCount, 0)
    },
    groups,
    occurrences,
    bridges,
    boundary: BRIGDE_FOUNDATION_BOUNDARY
  };
}

// Compatibility aliases preserve the original endpoint and imports while the
// authoritative name and ordering remain BRIGDE.
export const BRIDGE_FOUNDATION_VERSION = BRIGDE_FOUNDATION_VERSION;
export const BRIDGE_FOUNDATION_ACRONYM = BRIGDE_FOUNDATION_ACRONYM;
export const BRIDGE_FOUNDATION_BOUNDARY = BRIGDE_FOUNDATION_BOUNDARY;
export const buildBridgeStructure = buildBrigdeStructure;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
