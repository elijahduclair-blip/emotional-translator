import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildColorAtlasTrainingDataset,
  loadColorAtlasTrainingSource
} from '../src/lib/color-atlas-training-dataset.js';

test('the reviewed four-page PDF source accounts for all 95 color rows', () => {
  const source = loadColorAtlasTrainingSource();
  const tierCounts = source.records.reduce((counts, record) => {
    counts[record.tier] = (counts[record.tier] || 0) + 1;
    return counts;
  }, {});

  assert.equal(source.source.sha256, '886f00fc15bbe68a2994278d18a4117aa0faf545e88d389869feb60922839d76');
  assert.equal(source.source.pageCount, 4);
  assert.equal(source.recordCount, 95);
  assert.deepEqual(tierCounts, { base: 15, bridge: 11, shade: 69 });
  assert.equal(source.records.every(record => record.provenance.sourceDocument === source.source.document), true);
});

test('visually repaired bridge rows retain exact names and medium-confidence provenance', () => {
  const source = loadColorAtlasTrainingSource();
  const repaired = source.records.filter(record => record.provenance.extractionConfidence === 'medium');

  assert.deepEqual(repaired.map(record => [record.name, record.hexColor, record.provenance.page, record.provenance.row]), [
    ['Midnight Blue × Midnight Ocean', '#191970', 1, 21],
    ['Moon Silver × Moonstone', '#B0B0C0', 1, 22],
    ['Sage × Lavender Fog', '#B4A7A0', 1, 25]
  ]);
});

test('converter creates four deterministic verified lessons for every source row', () => {
  const result = buildColorAtlasTrainingDataset();
  const taskCounts = result.records.reduce((counts, record) => {
    counts[record.task] = (counts[record.task] || 0) + 1;
    return counts;
  }, {});

  assert.equal(result.sourceRecordCount, 95);
  assert.equal(result.selection.returned, 95);
  assert.equal(result.recordCount, 380);
  assert.equal(result.validation.valid, true);
  assert.equal(result.validation.sourceRowsAccountedFor, 95);
  assert.equal(result.jsonlBytes < 2 * 1024 * 1024, true);
  assert.deepEqual(taskCounts, {
    color_atlas_name_to_record: 95,
    color_atlas_record_to_name: 95,
    color_atlas_english_to_structural: 95,
    color_atlas_structural_to_english: 95
  });
  assert.equal(result.records.every(record => record.metadata.verified && record.metadata.roundTripExact), true);
});

test('coordinate neighbors are exact geometry and never semantic or anchor authority', () => {
  const result = buildColorAtlasTrainingDataset({ offset: 15, limit: 1 });
  const lookup = result.records.find(record => record.task === 'color_atlas_name_to_record');
  const payload = JSON.parse(lookup.messages[2].content);

  assert.equal(payload.name, 'Amber Glow');
  assert.equal(payload.nearestCoordinateNeighbors[0].name, 'Amber');
  assert.equal(payload.nearestCoordinateNeighbors[0].distance, 0);
  assert.deepEqual(payload.parents, []);
  assert.deepEqual(payload.semanticLabels, []);
  assert.equal(payload.boundary.importedTierIsCanonicalAnchor, false);
  assert.equal(payload.boundary.coordinateDistanceCreatesMeaning, false);
  assert.equal(result.boundary.canonicalAnchorMutationAllowed, false);
  assert.equal(result.boundary.semanticMutationAllowed, false);
  assert.equal(result.boundary.graphMutationAllowed, false);
  assert.equal(result.boundary.modelWeightsChanged, false);
});

test('color-atlas selection is bounded instead of truncating silently', () => {
  assert.throws(() => buildColorAtlasTrainingDataset({ offset: -1 }), error => error.status === 400);
  assert.throws(() => buildColorAtlasTrainingDataset({ offset: 95 }), error => error.status === 416);
  assert.throws(() => buildColorAtlasTrainingDataset({ limit: 96 }), error => error.status === 413);
});
