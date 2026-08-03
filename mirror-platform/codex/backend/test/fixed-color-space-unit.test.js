import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXED_COLOR_ANCHORS,
  buildKnowledgePlacements,
  fixedAnchor
} from '../src/engine/fixed-color-space.js';

test('nine fixed anchors occupy equal 40 degree compass sectors', () => {
  const degrees = FIXED_COLOR_ANCHORS.map(anchor => anchor.degreeOfVision).sort((a, b) => a - b);
  const gaps = degrees.map((degree, index) => {
    const next = degrees[(index + 1) % degrees.length] + (index === degrees.length - 1 ? 360 : 0);
    return next - degree;
  });

  assert.deepEqual(gaps, Array(9).fill(40));
  assert.equal(fixedAnchor('White').degreeOfVision, 90);
  assert.equal(fixedAnchor('grey').degreeOfVision, 330);
});

test('whole-number color addresses follow the canonical mirrored order', () => {
  assert.deepEqual(
    FIXED_COLOR_ANCHORS.map(anchor => [anchor.addressRoot, anchor.name]),
    [
      ['1', 'White'],
      ['2', 'Red'],
      ['3', 'Orange'],
      ['4', 'Yellow'],
      ['5', 'Gray'],
      ['6', 'Green'],
      ['7', 'Purple'],
      ['8', 'Blue'],
      ['9', 'Black']
    ]
  );

  assert.equal(Number(fixedAnchor('White').addressRoot) + Number(fixedAnchor('Black').addressRoot), 10);
  assert.equal(Number(fixedAnchor('Red').addressRoot) + Number(fixedAnchor('Blue').addressRoot), 10);
  assert.equal(Number(fixedAnchor('Orange').addressRoot) + Number(fixedAnchor('Purple').addressRoot), 10);
  assert.equal(Number(fixedAnchor('Yellow').addressRoot) + Number(fixedAnchor('Green').addressRoot), 10);
  assert.equal(fixedAnchor('grey').addressRoot, '5');
});

test('cardinal roots and shade-word decimal placement remain hierarchical', () => {
  const records = [
    record('white', 'White', 'base', []),
    record('cloud-white', 'Cloud White', 'shade', ['White'], 2),
    record('mist', 'Mist', 'words', ['Cloud White'], 3),
    record('blue', 'Blue', 'base', []),
    record('deep-blue', 'Deep Blue', 'shade', ['Blue'], 2)
  ];
  const placements = buildKnowledgePlacements(records);

  assert.equal(placements.get('white').decimalAddress, '1');
  assert.equal(placements.get('blue').decimalAddress, '8');
  assert.equal(placements.get('cloud-white').decimalAddress, '1.1');
  assert.equal(placements.get('mist').decimalAddress, '1.1.1');
  assert.equal(placements.get('deep-blue').decimalAddress, '8.1');
});

test('placement does not invent a new direction for an unresolved word', () => {
  const placements = buildKnowledgePlacements([
    record('unknown', 'Unclassified Signal', 'words', [])
  ]);

  assert.equal(placements.has('unknown'), false);
});

test('an unparented positioned node uses the nearest existing anchor instead of a new direction', () => {
  const records = [
    { ...record('white', 'White', 'base', []), coordinates: { x: 0, y: 100, z: 0 } },
    { ...record('blue', 'Blue', 'base', []), coordinates: { x: -94, y: 64, z: 8 } },
    { ...record('signal', 'Unparented Signal', 'shade', []), coordinates: { x: -90, y: 65, z: 9 } }
  ];
  const placement = buildKnowledgePlacements(records).get('signal');

  assert.equal(placement.fixedAnchor, 'Blue');
  assert.equal(placement.degreeOfVision, 170);
  assert.equal(placement.placementBasis, 'coordinate_fallback');
});

test('an explicit color parent outranks indirect category paths', () => {
  const records = [
    { ...record('red', 'Red', 'base', []), coordinates: { x: 94, y: 74, z: 68 } },
    { ...record('yellow', 'Yellow', 'base', []), coordinates: { x: 62, y: 88, z: 18 } },
    { ...record('stimulus', 'Stimulus', 'shade', ['Red']), coordinates: { x: 90, y: 75, z: 65 } },
    { ...record('amber-glow', 'Amber Glow', 'bridge', ['Stimulus', 'Yellow']), coordinates: { x: 90, y: 75, z: 65 } }
  ];
  const placement = buildKnowledgePlacements(records).get('amber-glow');

  assert.equal(placement.fixedAnchor, 'Yellow');
  assert.equal(placement.degreeOfVision, 130);
  assert.equal(placement.placementBasis, 'hierarchy');
});

function record(id, name, tier, parents, row = 1) {
  return {
    id,
    name,
    tier,
    parents,
    provenance: { page: 1, row }
  };
}
