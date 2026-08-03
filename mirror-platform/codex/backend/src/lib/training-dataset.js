import crypto from 'node:crypto';

export const TRAINING_DATASET_VERSION = '1.0.0';
export const TRAINING_INPUT_LIMIT = 12;
export const BRAILLE_TOKEN_VOCABULARY = Object.freeze(Array.from({ length: 64 }, (_, mask) => ({
  token: brailleToken(mask),
  mask,
  bits: mask.toString(2).padStart(6, '0'),
  unicode: String.fromCodePoint(0x2800 + mask),
  dots: Array.from({ length: 6 }, (_, dot) => dot + 1).filter(dot => mask & (1 << (dot - 1)))
})));

const TRAINING_SYSTEM = 'You are learning the deterministic structural language of Mirror Platform. Return only the exact JSON required by the task. Preserve order and never invent semantic or graph evidence.';

export function normalizeTrainingInputs(value) {
  if (!Array.isArray(value) || value.length === 0) throw httpError(400, 'inputs must be a non-empty array of English strings.');
  if (value.length > TRAINING_INPUT_LIMIT) throw httpError(413, `A dataset request may contain at most ${TRAINING_INPUT_LIMIT} inputs.`);
  const inputs = [];
  const seen = new Set();
  let totalCodePoints = 0;
  for (const item of value) {
    if (typeof item !== 'string') throw httpError(400, 'Every training input must be an English string.');
    const text = item.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!text) throw httpError(400, 'Every training input must contain English text.');
    const codePoints = [...text].length;
    if (codePoints > 2_000) throw httpError(413, 'Each training input must be 2000 Unicode code points or fewer.');
    totalCodePoints += codePoints;
    if (totalCodePoints > 10_000) throw httpError(413, 'Combined training input must be 10000 Unicode code points or fewer.');
    if (!seen.has(text)) {
      seen.add(text);
      inputs.push(text);
    }
  }
  return inputs;
}

export function buildVerifiedTrainingDataset(samples) {
  const records = [];
  const validations = [];
  for (const [sourceIndex, sample] of samples.entries()) {
    const validation = validateSample(sample.loop);
    validations.push({ sourceIndex: sourceIndex + 1, english: sample.loop.canonicalEnglish, ...validation });
    records.push(...recordsForSample(sample, sourceIndex + 1, validation));
  }
  const jsonlBytes = Buffer.byteLength(records.map(record => JSON.stringify(record)).join('\n'), 'utf8');
  if (jsonlBytes > 256 * 1024) throw httpError(413, 'Generated training dataset exceeds the 256 KB response budget.');

  return {
    engine: 'mirror_training_dataset_generator',
    version: TRAINING_DATASET_VERSION,
    format: 'chat_jsonl',
    tokenVocabulary: BRAILLE_TOKEN_VOCABULARY,
    sourceCount: samples.length,
    recordCount: records.length,
    jsonlBytes,
    validation: {
      valid: validations.every(item => item.valid),
      samples: validations
    },
    records,
    boundary: {
      mode: 'training_data_only',
      modelWeightsChanged: false,
      trainingStarted: false,
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      reason: 'The generator creates deterministic supervised examples. It does not train a model or modify approved meaning.'
    }
  };
}

function recordsForSample({ loop, meaning }, sourceIndex, validation) {
  const numbers = loop.encoding.numericSequence;
  const tokens = numbers.map(brailleToken);
  const sharedMetadata = {
    generatorVersion: TRAINING_DATASET_VERSION,
    sourceIndex,
    sourceHash: sha256(loop.canonicalEnglish),
    verified: validation.valid,
    roundTripExact: validation.roundTripExact,
    cellCount: validation.cellCount,
    authority: 'deterministic_training_example'
  };
  const foundation = {
    stats: loop.processing.foundation.stats,
    wordCounts: loop.processing.foundation.wordCounts,
    coOccurrences: loop.processing.foundation.coOccurrences.slice(0, 24),
    signatureIds: loop.processing.foundation.signatureIds
  };
  const relationships = {
    sourceLayer: meaning.approvedGraph.sourceLayer,
    nodes: meaning.approvedGraph.nodes,
    routes: meaning.approvedGraph.routes,
    wordNet: meaning.wordNet
  };

  return [
    record('english_to_structural', loop.canonicalEnglish, {
      task: 'Encode English as exact ordered six-dot structure.',
      english: loop.canonicalEnglish
    }, {
      braille: loop.encoding.ueb,
      tokens,
      numbers,
      binary: loop.encoding.binarySequence
    }, sharedMetadata),
    record('structural_to_english', loop.canonicalEnglish, {
      task: 'Reconstruct canonical English from exact ordered six-dot structure.',
      braille: loop.encoding.ueb,
      tokens,
      numbers
    }, {
      english: loop.decoding.english,
      roundTripExact: loop.decoding.roundTripExact
    }, sharedMetadata),
    record('ordered_foundation', loop.canonicalEnglish, {
      task: 'Return the deterministic ordered Foundation analysis.',
      english: loop.canonicalEnglish
    }, foundation, sharedMetadata),
    record('relational_grounding', loop.canonicalEnglish, {
      task: 'Return only supplied approved-graph and lexical evidence.',
      english: loop.canonicalEnglish
    }, relationships, sharedMetadata)
  ];
}

function record(task, english, input, output, metadata) {
  const assistant = JSON.stringify(output);
  return {
    id: `train_${sha256(`${TRAINING_DATASET_VERSION}|${task}|${english}|${assistant}`).slice(0, 20)}`,
    task,
    messages: [
      { role: 'system', content: TRAINING_SYSTEM },
      { role: 'user', content: JSON.stringify(input) },
      { role: 'assistant', content: assistant }
    ],
    metadata: { ...metadata, task }
  };
}

function validateSample(loop) {
  const cells = loop.encoding.cells;
  const numbers = loop.encoding.numericSequence;
  const binary = loop.encoding.binarySequence;
  const aligned = cells.length === numbers.length && cells.length === binary.length && cells.every((cell, index) => (
    cell.mask === numbers[index]
    && cell.bits === binary[index]
    && cell.unicode.codePointAt(0) === 0x2800 + cell.mask
  ));
  const roundTripExact = loop.decoding.roundTripExact === true && loop.decoding.english === loop.canonicalEnglish;
  if (!aligned || !roundTripExact) throw httpError(422, `Training sample failed deterministic validation: ${loop.canonicalEnglish}`);
  return { valid: true, roundTripExact, cellAlignmentExact: aligned, cellCount: cells.length };
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
