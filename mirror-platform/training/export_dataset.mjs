import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildColorAtlasTrainingDataset,
  loadColorAtlasTrainingSource
} from '../codex/backend/src/lib/color-atlas-training-dataset.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(directory, 'data');
const dataset = buildColorAtlasTrainingDataset();
const groups = groupBySource(dataset.records);
const split = stratifiedSourceSplit(groups, 0.2);
const ruleGroups = groupBySource(buildRuleRecords(dataset, loadColorAtlasTrainingSource()));

await fs.mkdir(outputDirectory, { recursive: true });

const all = await writeSplit('all', split, () => true);
const core = await writeSplit('core', split, record => (
  record.task === 'color_atlas_name_to_record' || record.task === 'color_atlas_record_to_name'
));
const rules = await writeSplit('rules', split, () => true, ruleGroups);

const manifest = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  source: dataset.source,
  sourceRecordCount: dataset.sourceRecordCount,
  splitStrategy: 'deterministic_sha256_within_source_tier',
  validationFraction: 0.2,
  sourceSplits: {
    training: split.trainSourceIds.length,
    validation: split.validationSourceIds.length,
    trainingByTier: split.trainTierCounts,
    validationByTier: split.validationTierCounts
  },
  datasets: { all, core, rules },
  boundary: dataset.boundary
};

await fs.writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));

async function writeSplit(name, sourceSplit, include, recordGroups = groups) {
  const train = sourceSplit.trainSourceIds.flatMap(id => recordGroups.get(id).filter(include));
  const validation = sourceSplit.validationSourceIds.flatMap(id => recordGroups.get(id).filter(include));
  const trainPath = path.join(outputDirectory, `train-${name}.jsonl`);
  const validationPath = path.join(outputDirectory, `validation-${name}.jsonl`);
  const trainText = toJsonl(train);
  const validationText = toJsonl(validation);
  await fs.writeFile(trainPath, trainText, 'utf8');
  await fs.writeFile(validationPath, validationText, 'utf8');
  return {
    tasks: [...new Set([...train, ...validation].map(record => record.task))],
    trainingRecords: train.length,
    validationRecords: validation.length,
    trainingSha256: sha256(trainText),
    validationSha256: sha256(validationText),
    trainingFile: path.basename(trainPath),
    validationFile: path.basename(validationPath)
  };
}

function buildRuleRecords(trainingDataset, source) {
  const exactRecords = new Map(trainingDataset.records
    .filter(record => record.task === 'color_atlas_name_to_record')
    .map(record => [record.metadata.sourceId, {
      exact: JSON.parse(record.messages[2].content),
      system: record.messages[0].content,
      metadata: record.metadata
    }]));
  const records = [];

  for (const sourceRecord of source.records) {
    const grounded = exactRecords.get(sourceRecord.id);
    const sourceRef = grounded.exact.sourceRef;
    const recordInput = {
      id: sourceRecord.id,
      tier: sourceRecord.tier,
      name: sourceRecord.name,
      hexColor: sourceRecord.hexColor,
      coordinates: sourceRecord.coordinates,
      sourceRef
    };
    records.push(derivedRuleRecord(
      'color_atlas_authority_boundary',
      sourceRecord,
      grounded,
      {
        task: 'Classify the authority of this imported PDF color record.',
        record: recordInput
      },
      {
        sourceLayer: 'chromabridge_knowledge',
        importedTierIsCanonicalAnchor: false,
        coordinateDistanceCreatesMeaning: false,
        semanticMutationAllowed: false,
        graphMutationAllowed: false
      }
    ));

    records.push(derivedRuleRecord(
      'color_atlas_coordinate_evidence_boundary',
      sourceRecord,
      grounded,
      {
        task: 'Preserve the supplied deterministic coordinate evidence and return its authority boundary.',
        origin: recordInput,
        computedEvidence: {
          method: 'euclidean_coordinate_distance',
          nearestCoordinateNeighbors: grounded.exact.nearestCoordinateNeighbors
        }
      },
      {
        method: 'euclidean_coordinate_distance',
        nearestCoordinateNeighbors: grounded.exact.nearestCoordinateNeighbors,
        coordinateDistanceCreatesMeaning: false,
        semanticMutationAllowed: false,
        graphMutationAllowed: false
      }
    ));
  }
  return records;
}

function derivedRuleRecord(task, sourceRecord, grounded, input, output) {
  const assistant = JSON.stringify(output);
  return {
    id: `rule_train_${sha256(`1.0.0|${task}|${sourceRecord.id}|${assistant}`).slice(0, 20)}`,
    task,
    messages: [
      { role: 'system', content: grounded.system },
      { role: 'user', content: JSON.stringify(input) },
      { role: 'assistant', content: assistant }
    ],
    metadata: {
      generatorVersion: '1.0.0',
      sourceId: sourceRecord.id,
      sourceTier: sourceRecord.tier,
      sourceRef: grounded.exact.sourceRef,
      verified: true,
      authority: 'deterministic_rule_training_example',
      semanticAuthority: false,
      canonicalAnchorAuthority: false,
      task
    }
  };
}

function groupBySource(records) {
  const grouped = new Map();
  for (const record of records) {
    const current = grouped.get(record.metadata.sourceId) || [];
    current.push(record);
    grouped.set(record.metadata.sourceId, current);
  }
  return grouped;
}

function stratifiedSourceSplit(grouped, validationFraction) {
  const tiers = new Map();
  for (const [sourceId, records] of grouped) {
    const tier = records[0].metadata.sourceTier;
    const current = tiers.get(tier) || [];
    current.push(sourceId);
    tiers.set(tier, current);
  }

  const trainSourceIds = [];
  const validationSourceIds = [];
  const trainTierCounts = {};
  const validationTierCounts = {};
  for (const [tier, sourceIds] of [...tiers.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const ordered = sourceIds.sort((left, right) => sha256(left).localeCompare(sha256(right)));
    const validationCount = Math.max(1, Math.round(ordered.length * validationFraction));
    const validation = ordered.slice(0, validationCount);
    const train = ordered.slice(validationCount);
    validationSourceIds.push(...validation);
    trainSourceIds.push(...train);
    validationTierCounts[tier] = validation.length;
    trainTierCounts[tier] = train.length;
  }
  return { trainSourceIds, validationSourceIds, trainTierCounts, validationTierCounts };
}

function toJsonl(records) {
  return `${records.map(record => JSON.stringify({
    id: record.id,
    task: record.task,
    messages: record.messages,
    metadata: record.metadata
  })).join('\n')}\n`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
