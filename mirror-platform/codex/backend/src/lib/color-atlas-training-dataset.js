import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BRAILLE_TOKEN_VOCABULARY } from './training-dataset.js';
import { runStructuralLanguageLoop } from './language-loop.js';

export const COLOR_ATLAS_TRAINING_VERSION = '1.0.0';
export const COLOR_ATLAS_RECORD_LIMIT = 95;

const SOURCE_URL = new URL('../../../data/chromabridge-export-example.json', import.meta.url);
const TRAINING_SYSTEM = 'You are learning exact imported ChromaBridge reference knowledge. Return only the supplied JSON. Preserve source names, coordinates, order, and provenance. Never invent parents, semantic labels, emotional meaning, graph approval, or canonical compass anchors.';
let cachedSource;

export function loadColorAtlasTrainingSource() {
  if (cachedSource) return cachedSource;
  const manifest = JSON.parse(readFileSync(SOURCE_URL, 'utf8').replace(/^\uFEFF/u, ''));
  const records = manifest.pageFiles.flatMap(file => JSON.parse(readFileSync(new URL(`../../../data/${file}`, import.meta.url), 'utf8')));
  const source = { ...manifest, records };
  validateSource(source);
  cachedSource = source;
  return cachedSource;
}

export function buildColorAtlasTrainingDataset(options = {}) {
  const source = loadColorAtlasTrainingSource();
  const { offset, limit } = normalizeSelection(options, source.records.length);
  const selected = source.records.slice(offset, offset + limit);
  const records = [];
  const validations = [];

  for (const atlasRecord of selected) {
    const loop = runStructuralLanguageLoop(canonicalAtlasFact(atlasRecord));
    const validation = validateLoop(loop);
    const exactRecord = exactAtlasRecord(atlasRecord, source.records);
    validations.push({
      sourceId: atlasRecord.id,
      name: atlasRecord.name,
      sourceRef: exactRecord.sourceRef,
      ...validation
    });
    records.push(...trainingRecords(atlasRecord, exactRecord, loop, validation));
  }

  const jsonlBytes = Buffer.byteLength(records.map(record => JSON.stringify(record)).join('\n'), 'utf8');
  if (jsonlBytes > 2 * 1024 * 1024) throw httpError(413, 'Generated color-atlas dataset exceeds the 2 MB response budget.');

  return {
    engine: 'mirror_color_atlas_training_converter',
    version: COLOR_ATLAS_TRAINING_VERSION,
    format: 'chat_jsonl',
    source: source.source,
    sourceRecordCount: source.records.length,
    selection: { offset, limit, returned: selected.length },
    tierCounts: countTiers(selected),
    tokenVocabulary: BRAILLE_TOKEN_VOCABULARY,
    recordCount: records.length,
    jsonlBytes,
    validation: {
      valid: validations.every(item => item.valid),
      sourceRowsAccountedFor: validations.length,
      samples: validations
    },
    records,
    boundary: {
      mode: 'imported_knowledge_training_data_only',
      modelWeightsChanged: false,
      trainingStarted: false,
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      canonicalAnchorMutationAllowed: false,
      coordinateDistanceCreatesMeaning: false,
      reason: 'The converter creates verified lessons from imported PDF rows. Source tier and coordinate distance remain reference facts and do not redefine the approved nine-anchor compass.'
    }
  };
}

function trainingRecords(atlasRecord, exactRecord, loop, validation) {
  const sharedMetadata = {
    generatorVersion: COLOR_ATLAS_TRAINING_VERSION,
    sourceId: atlasRecord.id,
    sourceRef: exactRecord.sourceRef,
    verified: validation.valid,
    roundTripExact: validation.roundTripExact,
    cellCount: validation.cellCount,
    authority: 'imported_reference_training_example',
    semanticAuthority: false,
    canonicalAnchorAuthority: false
  };
  const tokens = loop.encoding.numericSequence.map(brailleToken);

  return [
    trainingRecord('color_atlas_name_to_record', atlasRecord.id, {
      task: 'Return the exact imported color-atlas record and coordinate neighbors.',
      name: atlasRecord.name,
      sourceDocument: exactRecord.sourceRef.document
    }, exactRecord, sharedMetadata),
    trainingRecord('color_atlas_record_to_name', atlasRecord.id, {
      task: 'Return the exact source identity for this imported color record.',
      tier: atlasRecord.tier,
      hexColor: atlasRecord.hexColor,
      coordinates: atlasRecord.coordinates,
      sourceRef: exactRecord.sourceRef
    }, {
      id: atlasRecord.id,
      name: atlasRecord.name,
      tier: atlasRecord.tier
    }, sharedMetadata),
    trainingRecord('color_atlas_english_to_structural', atlasRecord.id, {
      task: 'Encode this source-grounded English fact as exact ordered six-dot structure.',
      english: loop.canonicalEnglish
    }, {
      braille: loop.encoding.ueb,
      tokens,
      numbers: loop.encoding.numericSequence,
      binary: loop.encoding.binarySequence
    }, sharedMetadata),
    trainingRecord('color_atlas_structural_to_english', atlasRecord.id, {
      task: 'Reconstruct the exact source-grounded English fact from ordered six-dot structure.',
      braille: loop.encoding.ueb,
      tokens,
      numbers: loop.encoding.numericSequence
    }, {
      english: loop.decoding.english,
      roundTripExact: loop.decoding.roundTripExact
    }, sharedMetadata)
  ];
}

function exactAtlasRecord(record, allRecords) {
  return {
    id: record.id,
    tier: record.tier,
    name: record.name,
    hexColor: record.hexColor,
    coordinates: record.coordinates,
    parents: record.parents,
    semanticLabels: record.semanticLabels,
    nearestCoordinateNeighbors: nearestNeighbors(record, allRecords),
    sourceRef: {
      document: record.provenance.sourceDocument,
      sha256: record.provenance.sourceSha256,
      page: record.provenance.page,
      row: record.provenance.row,
      extractionConfidence: record.provenance.extractionConfidence
    },
    boundary: {
      sourceLayer: 'chromabridge_knowledge',
      importedTierIsCanonicalAnchor: false,
      coordinateDistanceCreatesMeaning: false,
      semanticMutationAllowed: false
    }
  };
}

function nearestNeighbors(record, allRecords) {
  return allRecords
    .filter(candidate => candidate.id !== record.id)
    .map(candidate => ({
      id: candidate.id,
      name: candidate.name,
      tier: candidate.tier,
      distance: coordinateDistance(record.coordinates, candidate.coordinates)
    }))
    .sort((left, right) => left.distance - right.distance || left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
    .slice(0, 3);
}

function coordinateDistance(left, right) {
  const distance = Math.hypot(right.x - left.x, right.y - left.y, right.z - left.z);
  return Number(distance.toFixed(6));
}

function canonicalAtlasFact(record) {
  const spokenName = record.name.replace(/\s*×\s*/gu, ' cross ').replace(/\s+/gu, ' ').trim();
  return `The ChromaBridge export records ${spokenName} as a ${record.tier} color with hexadecimal ${record.hexColor.slice(1)} at coordinates X ${record.coordinates.x}, Y ${record.coordinates.y}, Z ${record.coordinates.z}.`;
}

function trainingRecord(task, sourceId, input, output, metadata) {
  const assistant = JSON.stringify(output);
  return {
    id: `atlas_train_${sha256(`${COLOR_ATLAS_TRAINING_VERSION}|${task}|${sourceId}|${assistant}`).slice(0, 20)}`,
    task,
    messages: [
      { role: 'system', content: TRAINING_SYSTEM },
      { role: 'user', content: JSON.stringify(input) },
      { role: 'assistant', content: assistant }
    ],
    metadata: { ...metadata, task }
  };
}

function validateLoop(loop) {
  const cells = loop.encoding.cells;
  const numbers = loop.encoding.numericSequence;
  const binary = loop.encoding.binarySequence;
  const cellAlignmentExact = cells.length === numbers.length && cells.length === binary.length && cells.every((cell, index) => (
    cell.mask === numbers[index]
    && cell.bits === binary[index]
    && cell.unicode.codePointAt(0) === 0x2800 + cell.mask
  ));
  const roundTripExact = loop.decoding.roundTripExact === true && loop.decoding.english === loop.canonicalEnglish;
  if (!cellAlignmentExact || !roundTripExact) throw httpError(422, `Color-atlas training sample failed deterministic validation: ${loop.canonicalEnglish}`);
  return { valid: true, roundTripExact, cellAlignmentExact, cellCount: cells.length };
}

function normalizeSelection(options, recordCount) {
  const offset = integerOption(options.offset, 0, 'offset');
  const remaining = Math.max(recordCount - offset, 0);
  const limit = integerOption(options.limit, remaining, 'limit');
  if (offset >= recordCount) throw httpError(416, `offset must be between 0 and ${recordCount - 1}.`);
  if (limit < 1) throw httpError(400, 'limit must be at least 1.');
  if (limit > COLOR_ATLAS_RECORD_LIMIT) throw httpError(413, `A color-atlas dataset request may contain at most ${COLOR_ATLAS_RECORD_LIMIT} source rows.`);
  return { offset, limit: Math.min(limit, remaining) };
}

function integerOption(value, fallback, name) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw httpError(400, `${name} must be a non-negative integer.`);
  return parsed;
}

function validateSource(source) {
  if (source?.kind !== 'chromabridge_color_atlas_training_source') throw new Error('Unexpected color-atlas training source kind.');
  if (!Array.isArray(source.records) || source.recordCount !== source.records.length || !source.records.length) {
    throw new Error('Color-atlas source record count does not match its records array.');
  }
  const ids = new Set();
  for (const record of source.records) {
    if (ids.has(record.id)) throw new Error(`Duplicate color-atlas source ID: ${record.id}`);
    ids.add(record.id);
    if (!['base', 'bridge', 'shade'].includes(record.tier)) throw new Error(`Unsupported source tier: ${record.tier}`);
    if (!record.name || !/^#[0-9A-F]{6}$/u.test(record.hexColor)) throw new Error(`Invalid source color record: ${record.id}`);
    if (!['x', 'y', 'z'].every(axis => Number.isFinite(record.coordinates?.[axis]))) throw new Error(`Invalid coordinates for source record: ${record.id}`);
    if (!Array.isArray(record.parents) || !Array.isArray(record.semanticLabels)) throw new Error(`Invalid relationship fields for source record: ${record.id}`);
    if (record.provenance?.sourceSha256 !== source.source.sha256 || !Number.isInteger(record.provenance?.page) || !Number.isInteger(record.provenance?.row)) {
      throw new Error(`Invalid provenance for source record: ${record.id}`);
    }
  }
}

function countTiers(records) {
  return records.reduce((counts, record) => {
    counts[record.tier] = (counts[record.tier] || 0) + 1;
    return counts;
  }, {});
}

function brailleToken(mask) {
  return `<B${String(mask).padStart(2, '0')}>`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
