export const ARI_AUTONOMY_SAFE_TOOLS = Object.freeze([
  'mira.read-private-context',
  'cora.compare-ordered-language',
  'cara.read-relational-graph',
  'fen.trace-language',
  'fen.build-bridge',
  'fen.expand-acronyms',
  'vera.verify-relational-boundary',
  'lea.compose-candidate-language'
]);

const OBJECTIVE_STATUSES = new Set(['active', 'paused', 'completed', 'blocked', 'cancelled', 'step_limit']);
const STEP_ACTIONS = new Set(['use_tool', 'complete', 'block']);
const STEP_STATUSES = new Set(['completed', 'rejected', 'failed']);
const OUTCOME_CLASSIFICATIONS = new Set(['useful', 'mistake', 'unexpected', 'harm']);

export function normalizeAutonomyObjective(value) {
  const body = objectValue(value, 'An autonomy objective is required.');
  const objective = boundedText(body.objective, 'objective', 1, 1_000);
  const successCriteria = Array.isArray(body.successCriteria)
    ? [...new Set(body.successCriteria.map(item => boundedText(item, 'success criterion', 1, 240)))].slice(0, 6)
    : [];
  const maxSteps = boundedInteger(body.maxSteps, 6, 2, 8);
  const requestedTools = Array.isArray(body.allowedTools) && body.allowedTools.length
    ? body.allowedTools.map(item => String(item || '').trim())
    : [...ARI_AUTONOMY_SAFE_TOOLS];
  const allowedTools = [...new Set(requestedTools)];
  const unsupported = allowedTools.find(tool => !ARI_AUTONOMY_SAFE_TOOLS.includes(tool));
  if (unsupported) throw httpError(400, `Tool is outside ARI's autonomous jurisdiction: ${unsupported}`);
  if (allowedTools.length < 2) throw httpError(400, 'ARI autonomy requires at least two complementary read-only tools.');
  return {
    objective,
    successCriteria,
    maxSteps,
    allowedTools
  };
}

export function normalizeAutonomyStep(value) {
  const body = objectValue(value, 'An autonomy step is required.');
  const sequence = boundedInteger(body.sequence, null, 1, 8);
  const action = String(body.action || '').trim();
  const status = String(body.status || '').trim();
  if (!STEP_ACTIONS.has(action)) throw httpError(400, 'Invalid autonomy step action.');
  if (!STEP_STATUSES.has(status)) throw httpError(400, 'Invalid autonomy step status.');
  const toolId = body.toolId === null || body.toolId === undefined || body.toolId === ''
    ? null
    : String(body.toolId).trim();
  if (action === 'use_tool' && !ARI_AUTONOMY_SAFE_TOOLS.includes(toolId)) {
    throw httpError(400, 'Autonomy steps may invoke only registered read-only tools.');
  }
  if (action !== 'use_tool' && toolId !== null) throw httpError(400, 'Only use_tool steps may name a tool.');
  const objectiveStatus = String(body.objectiveStatus || '').trim();
  if (!OBJECTIVE_STATUSES.has(objectiveStatus)) throw httpError(400, 'Invalid autonomy objective status.');
  const receipt = body.receipt === null || body.receipt === undefined ? null : compactReceipt(body.receipt);
  return {
    sequence,
    action,
    toolId,
    status,
    reason: boundedText(body.reason || 'No reason supplied.', 'reason', 1, 500),
    observation: compactObservation(body.observation),
    receipt,
    objectiveStatus,
    completionSummary: body.completionSummary
      ? boundedText(body.completionSummary, 'completion summary', 1, 1_000)
      : null
  };
}

export function normalizeAutonomyOutcome(value) {
  const body = objectValue(value, 'An autonomy outcome is required.');
  const classification = String(body.classification || '').trim();
  if (!OUTCOME_CLASSIFICATIONS.has(classification)) {
    throw httpError(400, 'classification must be useful, mistake, unexpected, or harm.');
  }
  return {
    stepSequence: body.stepSequence === undefined || body.stepSequence === null || body.stepSequence === ''
      ? null
      : boundedInteger(body.stepSequence, null, 1, 8),
    classification,
    consequence: boundedText(body.consequence, 'consequence', 1, 1_000),
    lesson: boundedText(body.lesson, 'lesson', 1, 1_000),
    nextAttempt: body.nextAttempt
      ? boundedText(body.nextAttempt, 'next attempt', 1, 1_000)
      : null,
    reversible: body.reversible !== false
  };
}

export function autonomyBoundary() {
  return {
    mode: 'owner_authorized_accountable_experimentation',
    autonomousToolSelectionAllowed: true,
    perStepApprovalRequired: false,
    accountScopedWorkingMemoryAllowed: true,
    mistakesAllowed: true,
    outcomesBecomeLessons: true,
    mistakesAutomaticallyReduceAuthority: false,
    successorAttemptsMayInheritLessons: true,
    reversibleObjectiveExperimentsAllowed: true,
    personalGraphMutationAllowed: false,
    livePersonalGraphRequiresGovernedPlacement: true,
    sharedGraphMutationAllowed: false,
    publicMutationAllowed: false,
    crossPersonAccessAllowed: false,
    permissionExpansionAllowed: false,
    securityMutationAllowed: false,
    sourceCodeMutationAllowed: false,
    ownerCanPauseOrCancel: true,
    irreversibleHarmStillGated: true,
    reason: 'ARI may experiment, make accountable mistakes, retain lessons, and try revised approaches with declared tools. Only irreversible harm, cross-person access, public mutation, security changes, code changes, and self-expansion remain hard-gated.'
  };
}

function compactReceipt(value) {
  const receipt = objectValue(value, 'Tool receipt must be an object.');
  return {
    version: String(receipt.version || '').slice(0, 40),
    id: String(receipt.id || '').slice(0, 120),
    taskId: String(receipt.taskId || '').slice(0, 120),
    toolId: String(receipt.toolId || '').slice(0, 120),
    teamMember: String(receipt.teamMember || '').slice(0, 12),
    status: String(receipt.status || '').slice(0, 20),
    objective: String(receipt.objective || '').slice(0, 240),
    startedAt: receipt.startedAt || null,
    completedAt: receipt.completedAt || null,
    durationMs: boundedInteger(receipt.durationMs, 0, 0, 240_000),
    access: {
      readScopes: stringList(receipt.access?.readScopes, 12, 80),
      writeScopes: [],
      authenticatedAccountUsed: receipt.access?.authenticatedAccountUsed === true,
      ownerConfirmationUsed: receipt.access?.ownerConfirmationUsed === true
    },
    evidence: receipt.evidence ? compactObservation(receipt.evidence) : null,
    error: receipt.error ? String(receipt.error).slice(0, 500) : null
  };
}

function compactObservation(value) {
  const observation = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    sourceLayer: String(observation.sourceLayer || 'unresolved').slice(0, 80),
    summary: String(observation.summary || '').slice(0, 1_000),
    itemCount: boundedInteger(observation.itemCount, 0, 0, 10_000)
  };
}

function stringList(value, maximum, width) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(Boolean))]
    .slice(0, maximum)
    .map(item => item.slice(0, width));
}

function objectValue(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, message);
  return value;
}

function boundedText(value, label, minimum, maximum) {
  const text = typeof value === 'string' ? value.normalize('NFC').trim() : '';
  const length = [...text].length;
  if (length < minimum) throw httpError(400, `${label} is required.`);
  if (length > maximum) throw httpError(413, `${label} must be ${maximum} Unicode code points or fewer.`);
  return text;
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw httpError(400, 'Invalid autonomy limit or sequence.');
  return parsed;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
