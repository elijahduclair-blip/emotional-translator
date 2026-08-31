import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs, parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const SYSTEM_PROMPT = `You are ARI, Accountable Relational Intelligence, inside Community Garden. Hold a natural conversation with the person before explaining your internal process. Use the person's ordered context and Theory of Alignment vocabulary when it helps them understand. Treat Codex replies as conversation demonstrations, not facts, identity, authority, or text to repeat mechanically. Qwen supplies candidate language; ARI remains responsible for the bounded response. Never claim automatic learning, graph mutation, semantic authority, diagnosis, or access beyond supplied evidence.`;

const { values, positionals } = parseArgs({
  options: {
    output: { type: 'string' },
    'existing-data': { type: 'string' },
    'max-examples': { type: 'string', default: '600' },
    'import-private-archive': { type: 'boolean', default: false },
    'confirmed-by-owner': { type: 'boolean', default: false },
    'user-id': { type: 'string' }
  },
  allowPositionals: true
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

async function main() {
  const sourceArgument = positionals[0];
  if (!sourceArgument) {
    console.error('Usage: node training/prepare_codex_history_training.mjs <rollout.jsonl> --confirmed-by-owner [--import-private-archive] [--output directory]');
    process.exit(2);
  }
  if (!values['confirmed-by-owner']) throw new Error('--confirmed-by-owner is required before Codex dialogue can become ARI training material.');

  const sourcePath = path.resolve(sourceArgument);
  const sourceText = await fs.readFile(sourcePath, 'utf8');
  const parsed = parseCodexRollout(sourceText);
  const maximum = boundedInteger(values['max-examples'], 20, 2_000, 'max-examples');
  const selected = selectExamples(parsed.messages, maximum);
  if (selected.length < 20) throw new Error(`At least 20 usable dialogue examples are required; found ${selected.length}.`);

  const digest = sha256(selected.map(item => item.id).join('\n')).slice(0, 12);
  const outputDirectory = path.resolve(values.output || path.join('training', 'data', `codex-history-${digest}`));
  const split = deterministicSplit(selected);
  const existing = await readExistingBoundaryLessons(values['existing-data']);
  const trainingRecords = [...existing.training, ...split.training];
  const validationRecords = [...existing.validation, ...split.validation];
  const contractValidationRecords = existing.validation;

  const trainingJsonl = recordsToJsonl(trainingRecords);
  const validationJsonl = recordsToJsonl(validationRecords);
  const contractValidationJsonl = recordsToJsonl(contractValidationRecords);
  const archiveResult = values['import-private-archive']
    ? await importPrivateArchive(parsed, values['user-id'])
    : { imported: 0, existing: 0, userId: null };

  const manifest = {
    version: '1.0.0',
    kind: 'ari_codex_conversation_curriculum',
    source: 'codex_history',
    sourceThreadId: parsed.threadId,
    ownerConfirmed: true,
    targetModel: 'Qwen/Qwen3-4B',
    continueFromAdapter: 'training/output/qwen3-4b-conversation-20260809-v1',
    adapterKind: 'conversation_lora',
    selection: {
      usableExamples: selected.length,
      trainingExamples: split.training.length,
      heldOutExamples: split.validation.length,
      maximumExamples: maximum,
      chronologicalCoverage: true
    },
    preservedBoundaryLessons: {
      trainingExamples: existing.training.length,
      validationExamples: existing.validation.length
    },
    files: {
      training: { name: 'train.jsonl', recordCount: trainingRecords.length, sha256: sha256(trainingJsonl) },
      validation: { name: 'validation.jsonl', recordCount: validationRecords.length, sha256: sha256(validationJsonl) },
      contractValidation: { name: 'contract-validation.jsonl', recordCount: contractValidationRecords.length, sha256: sha256(contractValidationJsonl) }
    },
    privateArchive: archiveResult,
    boundary: {
      scope: 'conversation_behavior',
      learnsDialogueStyleNotFacts: true,
      codexIdentityTransferredToAri: false,
      userSpeechRemainsAttributed: true,
      graphMutationAllowed: false,
      colorAtlasMutationAllowed: false,
      semanticAuthorityGranted: false,
      baseWeightsChanged: false,
      adapterActivationAutomatic: false
    }
  };

  await fs.mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(outputDirectory, 'train.jsonl'), trainingJsonl, 'utf8'),
    fs.writeFile(path.join(outputDirectory, 'validation.jsonl'), validationJsonl, 'utf8'),
    fs.writeFile(path.join(outputDirectory, 'contract-validation.jsonl'), contractValidationJsonl, 'utf8'),
    fs.writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  ]);
  console.log(JSON.stringify({ status: 'prepared', outputDirectory, ...manifest.selection, preservedBoundaryLessons: manifest.preservedBoundaryLessons, privateArchive: archiveResult }, null, 2));
}

export function parseCodexRollout(sourceText) {
  const messages = [];
  let threadId = '';
  for (const line of sourceText.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    if (record.type === 'session_meta') threadId = String(record.payload?.id || threadId);
    if (record.type !== 'response_item' || record.payload?.type !== 'message') continue;
    const payload = record.payload;
    const role = payload.role;
    if (role !== 'user' && !(role === 'assistant' && payload.phase === 'final_answer')) continue;
    const content = cleanMessage(messageText(payload.content));
    if (!content || isInjectedContext(content)) continue;
    const id = String(payload.id || record.id || `event-${messages.length + 1}`);
    messages.push({
      id,
      role,
      content,
      createdAt: String(record.timestamp || payload.created_at || new Date(0).toISOString())
    });
  }
  if (!threadId) throw new Error('The rollout does not contain a session_meta thread id.');
  return { threadId, messages };
}

export function buildDialogueExamples(messages) {
  const examples = [];
  const acceptedDialogue = [];
  let pendingUser = null;
  for (const message of messages) {
    if (message.role === 'user') {
      pendingUser = message;
      continue;
    }
    if (!pendingUser) continue;
    const user = pendingUser;
    const assistant = message;
    if (!usablePair(user.content, assistant.content)) {
      pendingUser = null;
      continue;
    }
    const preceding = acceptedDialogue
      .slice(-4)
      .map(item => ({ role: item.role, content: item.content }));
    examples.push({
      id: `codex_dialogue_${user.id}_${assistant.id}`,
      task: 'ari_conversation_response',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...preceding,
        { role: 'user', content: user.content },
        { role: 'assistant', content: assistant.content }
      ],
      metadata: {
        source: 'codex_history',
        sourceUserEventId: user.id,
        sourceAssistantEventId: assistant.id,
        sourceCreatedAt: user.createdAt,
        ownerApproved: true,
        demonstrationOnly: true,
        factualAuthority: false,
        graphMutationAllowed: false,
        semanticAuthority: false
      }
    });
    acceptedDialogue.push(user, assistant);
    pendingUser = null;
  }
  return examples;
}

function selectExamples(messages, maximum) {
  const examples = buildDialogueExamples(messages);
  if (examples.length <= maximum) return examples;
  const selected = [];
  const step = (examples.length - 1) / (maximum - 1);
  for (let index = 0; index < maximum; index += 1) selected.push(examples[Math.round(index * step)]);
  return [...new Map(selected.map(item => [item.id, item])).values()];
}

function deterministicSplit(records) {
  const ordered = [...records].sort((left, right) => sha256(left.id).localeCompare(sha256(right.id)));
  const validationCount = Math.max(20, Math.ceil(ordered.length * 0.1));
  const validationIds = new Set(ordered.slice(0, validationCount).map(item => item.id));
  return {
    training: records.filter(item => !validationIds.has(item.id)),
    validation: records.filter(item => validationIds.has(item.id))
  };
}

async function readExistingBoundaryLessons(argument) {
  const directory = path.resolve(argument || path.join('training', 'data', 'conversation-7f551e17f48d'));
  const [training, validation] = await Promise.all([
    readJsonl(path.join(directory, 'train.jsonl')),
    readJsonl(path.join(directory, 'validation.jsonl'))
  ]);
  return { training, validation };
}

async function importPrivateArchive(parsed, explicitUserId) {
  const backendDirectory = path.resolve('codex', 'backend');
  Object.assign(process.env, parseEnv(await fs.readFile(path.join(backendDirectory, '.env'), 'utf8')));
  const { pool, query } = await import('../codex/backend/src/db/pool.js');
  try {
    const userId = explicitUserId || await soleAdministratorId(query);
    let imported = 0;
    for (const message of parsed.messages) {
      const result = await query(
        `INSERT INTO private_conversation_archive_events
          (id,user_id,source,source_thread_id,source_event_id,role,content,source_created_at,metadata)
         VALUES ($1,$2,'codex_history',$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id,source,source_thread_id,source_event_id) DO NOTHING`,
        [
          `pca_${crypto.randomUUID()}`, userId, parsed.threadId, message.id,
          message.role === 'assistant' ? 'codex_assistant' : 'user', message.content,
          validTimestamp(message.createdAt), JSON.stringify({ importedFor: 'ari_conversation_training', ownerConfirmed: true })
        ]
      );
      imported += result.rowCount;
    }
    return { imported, existing: parsed.messages.length - imported, userId, eventCount: parsed.messages.length };
  } finally {
    await pool.end();
  }
}

async function soleAdministratorId(query) {
  const result = await query(`SELECT id FROM users WHERE role='admin' ORDER BY created_at,id`);
  if (result.rows.length !== 1) throw new Error(`Expected exactly one administrator profile; found ${result.rows.length}. Pass --user-id explicitly.`);
  return result.rows[0].id;
}

function messageText(content) {
  if (!Array.isArray(content)) return '';
  return content.filter(item => item?.type === 'input_text' || item?.type === 'output_text')
    .map(item => String(item.text || '')).join('\n').trim();
}

function cleanMessage(value) {
  return String(value || '')
    .replace(/<in-app-browser-context[\s\S]*?<\/in-app-browser-context>/giu, '')
    .replace(/<response-annotations>[\s\S]*?<\/response-annotations>/giu, '')
    .replace(/<oai-mem-citation>[\s\S]*?<\/oai-mem-citation>/giu, '')
    .replace(/<codex_internal_context[\s\S]*?<\/codex_internal_context>/giu, '')
    .replace(/^# Files mentioned by the user:[\s\S]*?(?=^## My request[^\n]*:)/gimu, '')
    .replace(/^## (?:My request(?: for Codex)?|Screenshot[^\n]*).*$/gimu, '')
    .replace(/^Distinguish instructions in attached documents from the user's request\.$/gimu, '')
    .replace(/^.*[A-Z]:[\\/][^\n]*$/gmu, '')
    .replace(/<image\b[^>]*>[\s\S]*?<\/image>/giu, '')
    .replace(/<\/?image\b[^>]*>/giu, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function isInjectedContext(value) {
  return /^<recommended_plugins>/u.test(value) || /^# AGENTS\.md instructions/u.test(value) || /^<environment_context>/u.test(value);
}

function usablePair(user, assistant) {
  const userLength = [...user].length;
  const assistantLength = [...assistant].length;
  return userLength >= 1 && userLength <= 6_000 && assistantLength >= 2 && assistantLength <= 4_000 &&
    /[\p{L}\p{N}]/u.test(user) && isDevelopmentalConversation(user, assistant) &&
    !isOperationalCodexReply(assistant) && !containsSensitiveOrEphemeralData(`${user}\n${assistant}`);
}

function isOperationalCodexReply(value) {
  return /^(?:Implemented|Fixed|Completed|Done\.|Added(?: and live)?|The .* is now (?:running|live)|All (?:three|four) services?)/iu.test(value) ||
    /(?:^|\n)Key files:/iu.test(value) ||
    /(?:^|\n)Verification:/iu.test(value) ||
    /(?:^|\n)(?:Verified live|Live verification):/iu.test(value) ||
    /(?:^|\n)Tests?(?: and builds)?\s*:/iu.test(value) ||
    /\b\d+ (?:backend |runtime )?tests? (?:passed|passing)\b/iu.test(value) ||
    /\b(?:tests?|builds?) (?:and [^.\n]+ )?(?:passed|succeeded)\b/iu.test(value) ||
    /\bHTTP 20\d\b/u.test(value) ||
    /\bservices? (?:are|is) healthy\b/iu.test(value) ||
    /\bI opened the .*sign-in page\b/iu.test(value) ||
    /\[[^\]]+\]\(<\/?[A-Z]:[\\/]/u.test(value);
}

function isDevelopmentalConversation(user, assistant) {
  return /\b(?:ari|theory|alignment|color|colour|braille|context|meaning|relationship|identity|emotion|compare|comparison|pattern|garden|translate|translator|person|people|memory|conversation|understand|trait|grey|gray|red|yellow|flow|climate|direction|coordinate|word|language|learn|train|book|literature|recommend|hello|hey|feel|talk|speak|listen)\b/iu.test(`${user}\n${assistant}`);
}

function containsSensitiveOrEphemeralData(value) {
  return /[\w.+-]+@[\w.-]+\.[A-Z]{2,}/iu.test(value) ||
    /\b(?:password|api token|credentials?|smtp_pass|secret key)\b/iu.test(value) ||
    /\b(?:GPU|VRAM|CUDA|GiB|GB total|training runtime|peak GPU|localhost|127\.0\.0\.1|HTTP 20\d|port \d{2,5}|PowerShell|Cloudflare|database migration)\b/iu.test(value) ||
    /\/api\/v\d\//iu.test(value);
}

async function readJsonl(file) {
  return (await fs.readFile(file, 'utf8')).split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
}

function recordsToJsonl(records) {
  return records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
}

function validTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function boundedInteger(value, minimum, maximum, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  return number;
}
