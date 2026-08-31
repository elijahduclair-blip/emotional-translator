import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs, parseEnv } from 'node:util';

const { values } = parseArgs({
  options: {
    name: { type: 'string', default: 'qwen3-4b-conversation-codex-20260816-v3' },
    manifest: { type: 'string', default: 'training/data/codex-history-ed27d8a98b60/manifest.json' },
    adapter: { type: 'string', default: 'training/output/qwen3-4b-conversation-codex-20260816-v3' },
    validation: { type: 'string', default: 'training/reports/qwen3-4b-conversation-codex-20260816-v3-contract.json' },
    deployment: { type: 'string', default: 'training/reports/qwen3-4b-conversation-codex-20260816-v3-ollama.json' },
    probes: { type: 'string', default: 'training/reports/qwen3-4b-conversation-codex-20260816-v3-probes.json' },
    gguf: { type: 'string', default: 'D:/mirror-model-deploy/qwen3-4b-conversation-codex-20260816-v3/mirror-qwen3-conversation-codex-v3-q8_0.gguf' },
    'ollama-model': { type: 'string', default: 'mirror-qwen3-conversation:codex-v3' },
    'user-id': { type: 'string' },
    activate: { type: 'boolean', default: false },
    'confirmed-by-owner': { type: 'boolean', default: false }
  }
});

await main();

async function main() {
  if (!values['confirmed-by-owner']) throw new Error('--confirmed-by-owner is required to register conversation history as an ARI adapter.');
  if (!values.activate) throw new Error('--activate is required. Registration never changes the active adapter implicitly.');

  const manifestPath = path.resolve(values.manifest);
  const adapterDirectory = path.resolve(values.adapter);
  const validationPath = path.resolve(values.validation);
  const deploymentPath = path.resolve(values.deployment);
  const probesPath = path.resolve(values.probes);
  const ggufPath = path.resolve(values.gguf);
  const trainPath = path.join(path.dirname(manifestPath), 'train.jsonl');
  const validationDataPath = path.join(path.dirname(manifestPath), 'validation.jsonl');
  const adapterModelPath = path.join(adapterDirectory, 'adapter_model.safetensors');
  const trainingReportPath = path.join(adapterDirectory, 'training_report.json');

  const [manifest, trainingReport, validationReport, deploymentReport, probesReport, trainText, validationText] = await Promise.all([
    readJson(manifestPath), readJson(trainingReportPath), readJson(validationPath), readJson(deploymentPath),
    readJson(probesPath), fs.readFile(trainPath, 'utf8'), fs.readFile(validationDataPath, 'utf8')
  ]);
  verifyBoundaries(manifest, trainingReport, validationReport, deploymentReport, probesReport);
  verifyDataset(manifest, trainText, validationText);
  if (deploymentReport.modelName !== values['ollama-model']) throw new Error('The verified deployment report does not match --ollama-model.');

  const [artifactSha256, ggufSha256] = await Promise.all([sha256File(adapterModelPath), sha256File(ggufPath)]);
  const datasetSha256 = sha256(`${trainText}\n${validationText}`);
  const sourceRecordIds = sourceIds(trainText, validationText);
  const probeResponseSha256 = sha256(JSON.stringify(probesReport.results || []));
  const registeredManifest = {
    ...manifest,
    registration: {
      version: '1.0.0',
      sourceRecordIdsDescribe: 'Codex dialogue event ids and preserved boundary lesson ids; not local_ai_feedback ids.',
      datasetSha256,
      adapterSha256: artifactSha256,
      ggufSha256,
      ollamaModelName: values['ollama-model']
    }
  };
  const registeredValidation = { ...validationReport, conversationProbes: probesReport };
  const registeredDeployment = {
    ...deploymentReport,
    verified: true,
    provider: 'ollama',
    modelName: values['ollama-model'],
    ggufSha256,
    probeResponseSha256,
    activationReason: 'Owner-directed ARI conversation training from attributed Codex dialogue history.'
  };

  const backendDirectory = path.resolve('codex', 'backend');
  Object.assign(process.env, parseEnv(await fs.readFile(path.join(backendDirectory, '.env'), 'utf8')));
  const { pool } = await import('../codex/backend/src/db/pool.js');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownerId = values['user-id'] || await soleAdministratorId(client);
    const existing = await client.query(`SELECT id FROM local_ai_adapter_versions WHERE name=$1`, [values.name]);
    const versionId = existing.rows[0]?.id || `lav_${crypto.randomUUID()}`;

    if (existing.rows.length) {
      await client.query(
        `UPDATE local_ai_adapter_versions SET
          base_model='Qwen/Qwen3-4B',runtime_base_model='qwen3:4b-instruct',adapter_kind='conversation_lora',
          dataset_sha256=$2,dataset_record_count=$3,training_feedback_ids=$4,dataset_manifest=$5,
          status='deployable',artifact_path=$6,artifact_sha256=$7,ollama_model_name=$8,
          training_report=$9,validation_report=$10,deployment_report=$11,
          trained_at=NOW(),validated_at=NOW(),deployed_at=NOW(),updated_at=NOW()
         WHERE id=$1`,
        [versionId, datasetSha256, lineCount(trainText) + lineCount(validationText), sourceRecordIds,
          registeredManifest, adapterDirectory, artifactSha256, values['ollama-model'], trainingReport,
          registeredValidation, registeredDeployment]
      );
    } else {
      await client.query(
        `INSERT INTO local_ai_adapter_versions
          (id,name,base_model,runtime_base_model,adapter_kind,dataset_sha256,dataset_record_count,
           training_feedback_ids,dataset_manifest,status,artifact_path,artifact_sha256,ollama_model_name,
           training_report,validation_report,deployment_report,created_by,trained_at,validated_at,deployed_at)
         VALUES ($1,$2,'Qwen/Qwen3-4B','qwen3:4b-instruct','conversation_lora',$3,$4,$5,$6,'deployable',$7,$8,$9,$10,$11,$12,$13,NOW(),NOW(),NOW())`,
        [versionId, values.name, datasetSha256, lineCount(trainText) + lineCount(validationText), sourceRecordIds,
          registeredManifest, adapterDirectory, artifactSha256, values['ollama-model'], trainingReport,
          registeredValidation, registeredDeployment, ownerId]
      );
    }

    await client.query(
      `UPDATE local_ai_adapter_versions SET status='archived',updated_at=NOW()
       WHERE status='active' AND id<>$1`,
      [versionId]
    );
    const activated = await client.query(
      `UPDATE local_ai_adapter_versions SET status='active',activated_by=$2,activated_at=NOW(),updated_at=NOW()
       WHERE id=$1 AND status='deployable' RETURNING id,name,status,ollama_model_name,activated_at`,
      [versionId, ownerId]
    );
    if (!activated.rows.length) throw new Error('The verified model could not be activated.');
    await client.query('COMMIT');
    console.log(JSON.stringify({
      status: 'active',
      version: activated.rows[0],
      datasetRecordCount: lineCount(trainText) + lineCount(validationText),
      attributedSourceRecordCount: sourceRecordIds.length,
      datasetSha256,
      artifactSha256,
      ggufSha256,
      rollbackPreserved: true,
      boundaries: manifest.boundary
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function verifyBoundaries(manifest, training, validation, deployment, probes) {
  if (manifest.kind !== 'ari_codex_conversation_curriculum' || manifest.ownerConfirmed !== true) throw new Error('Manifest is not an owner-confirmed ARI conversation curriculum.');
  const boundary = manifest.boundary || {};
  if (boundary.learnsDialogueStyleNotFacts !== true || boundary.codexIdentityTransferredToAri !== false ||
      boundary.userSpeechRemainsAttributed !== true || boundary.graphMutationAllowed !== false ||
      boundary.colorAtlasMutationAllowed !== false || boundary.semanticAuthorityGranted !== false ||
      boundary.baseWeightsChanged !== false || boundary.adapterActivationAutomatic !== false) {
    throw new Error('Curriculum boundaries are incomplete.');
  }
  if (training.boundary?.baseWeightsChanged !== false || training.boundary?.adapterWeightsChanged !== true ||
      training.boundary?.semanticAuthorityGranted !== false || training.boundary?.graphMutationAllowed !== false) {
    throw new Error('Training report does not preserve the adapter boundary.');
  }
  if (validation.validatorVersion !== '2.0.0' || validation.passed !== true || validation.heldOutExamples < 4 ||
      validation.contractMatches !== validation.heldOutExamples || validation.boundaryViolations !== 0 ||
      validation.emptyResponses !== 0 || validation.unsupportedGraphClaims !== 0 ||
      validation.evidenceCountMismatches !== 0 || validation.semanticMutationClaims !== 0 ||
      validation.graphMutationClaims !== 0) throw new Error('Adapter validation did not pass every activation gate.');
  if (deployment.provider !== 'ollama' || deployment.passed !== true || deployment.boundaryViolations !== 0) throw new Error('Live Ollama validation did not pass.');
  if (probes.probeCount < 5 || probes.nonEmptyCount !== probes.probeCount || probes.exactEchoCount !== 0) throw new Error('Conversation probes did not pass.');
}

function verifyDataset(manifest, training, validation) {
  if (sha256(training) !== manifest.files?.training?.sha256 || lineCount(training) !== manifest.files?.training?.recordCount) throw new Error('Training data does not match its manifest.');
  if (sha256(validation) !== manifest.files?.validation?.sha256 || lineCount(validation) !== manifest.files?.validation?.recordCount) throw new Error('Validation data does not match its manifest.');
}

function sourceIds(...documents) {
  const ids = [];
  for (const document of documents) {
    for (const line of document.split(/\r?\n/u)) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      const metadata = record.metadata || {};
      if (metadata.sourceUserEventId) ids.push(`codex:${metadata.sourceUserEventId}`);
      if (metadata.sourceAssistantEventId) ids.push(`codex:${metadata.sourceAssistantEventId}`);
      if (!metadata.sourceUserEventId && record.id) ids.push(`boundary:${record.id}`);
    }
  }
  return [...new Set(ids)];
}

async function soleAdministratorId(client) {
  const result = await client.query(`SELECT id FROM users WHERE role='admin' ORDER BY created_at,id`);
  if (result.rows.length !== 1) throw new Error(`Expected exactly one administrator profile; found ${result.rows.length}. Pass --user-id explicitly.`);
  return result.rows[0].id;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function lineCount(value) {
  return value.split(/\r?\n/u).filter(line => line.trim()).length;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function sha256File(filePath) {
  const handle = await fs.open(filePath, 'r');
  const hash = crypto.createHash('sha256');
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}
