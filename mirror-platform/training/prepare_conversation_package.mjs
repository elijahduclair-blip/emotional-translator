import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const [packagePath, outputArgument] = process.argv.slice(2);
if (!packagePath) {
  console.error('Usage: node training/prepare_conversation_package.mjs <downloaded-package.json> [output-directory]');
  process.exit(2);
}

const source = JSON.parse(await fs.readFile(path.resolve(packagePath), 'utf8'));
const manifest = source.manifest;
if (!manifest || typeof source.trainingJsonl !== 'string' || typeof source.validationJsonl !== 'string') {
  throw new Error('Training package must contain manifest, trainingJsonl, and validationJsonl.');
}
if (manifest.targetModel !== 'qwen3:4b-instruct' || manifest.adapterKind !== 'conversation_lora') {
  throw new Error('Training package is not a Qwen3 4B conversational LoRA package.');
}
verifyDigest(source.trainingJsonl, manifest.splits.training.sha256, 'training split');
verifyDigest(source.validationJsonl, manifest.splits.validation.sha256, 'validation split');
if (manifest.readiness?.readyToPrepareVersion !== true || manifest.splits.validation.recordCount < 4) {
  throw new Error('Training package has not met the reviewed-example and held-out validation gates.');
}

const output = path.resolve(outputArgument || path.join('training', 'data', `conversation-${manifest.datasetSha256.slice(0, 12)}`));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'train.jsonl'), source.trainingJsonl, 'utf8');
await fs.writeFile(path.join(output, 'validation.jsonl'), source.validationJsonl, 'utf8');
await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'prepared', output, trainingRecords: manifest.splits.training.recordCount, validationRecords: manifest.splits.validation.recordCount, datasetSha256: manifest.datasetSha256 }, null, 2));

function verifyDigest(value, expected, label) {
  const actual = crypto.createHash('sha256').update(value).digest('hex');
  if (actual !== expected) throw new Error(`${label} SHA-256 does not match its signed manifest.`);
}
