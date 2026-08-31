import crypto from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ACTIVE_STATUSES = new Set(['queued', 'running', 'waiting', 'paused']);

export class AriStateStore {
  constructor(directory) {
    this.directory = directory;
    this.snapshotPath = join(directory, 'state.json');
    this.journalPath = join(directory, 'journal.jsonl');
    this.workspacePath = join(directory, 'workspace');
    this.state = null;
  }

  initialize() {
    mkdirSync(this.workspacePath, { recursive: true });
    this.state = existsSync(this.snapshotPath)
      ? normalizeState(JSON.parse(readFileSync(this.snapshotPath, 'utf8')))
      : emptyState();
    for (const objective of this.state.objectives) {
      if (objective.status === 'running') {
        objective.status = 'queued';
        objective.updatedAt = now();
        this.recordEvent('objective.recovered', objective.id, objective.ownerKey, { reason: 'runtime_restart' }, false);
      }
      if (objective.status === 'completed' && !objective.steps.some(step => step.action === 'use_tool' && step.status === 'completed')) {
        objective.status = 'queued';
        objective.completionSummary = null;
        objective.updatedAt = now();
        this.state.lessons.push({
          id: crypto.randomUUID(), objectiveId: objective.id, ownerKey: objective.ownerKey,
          consequence: 'The runtime previously accepted completion without successful tool evidence.',
          lesson: 'A completion summary is a claim, not proof. Produce an inspectable tool result before completing.',
          nextAttempt: 'Use a tool that directly satisfies or verifies the objective criteria.', reversible: true, createdAt: now()
        });
        this.recordEvent('objective.recovered', objective.id, objective.ownerKey, { reason: 'completion_without_tool_evidence' }, false);
      }
    }
    this.persist();
    return this.status();
  }

  status() {
    const objectives = this.state.objectives;
    return {
      paused: this.state.runtime.paused,
      startedAt: this.state.runtime.startedAt,
      objectiveCounts: Object.fromEntries(['queued', 'running', 'waiting', 'paused', 'completed', 'blocked', 'cancelled', 'step_limit']
        .map(status => [status, objectives.filter(item => item.status === status).length])),
      lessonCount: this.state.lessons.length,
      journalEventCount: this.state.eventCount
    };
  }

  setRuntimePaused(paused) {
    this.state.runtime.paused = paused === true;
    this.state.runtime.updatedAt = now();
    this.recordEvent(paused ? 'runtime.paused' : 'runtime.resumed', null, 'system', {}, false);
    this.persist();
  }

  createObjective(ownerKey, input, source = 'owner', parentId = null) {
    const objectiveText = boundedText(input.objective, 'objective', 2_000);
    const successCriteria = Array.isArray(input.successCriteria)
      ? input.successCriteria.map(value => boundedText(value, 'success criterion', 500)).slice(0, 12)
      : [];
    const parent = parentId ? this.getObjective(ownerKey, parentId) : null;
    const depth = parent ? parent.depth + 1 : 0;
    if (depth > 4) throw runtimeError(409, 'ARI reached the follow-up objective depth limit for this branch.');
    const timestamp = now();
    const objective = {
      id: crypto.randomUUID(),
      ownerKey,
      objective: objectiveText,
      successCriteria: successCriteria.length ? successCriteria : ['Produce a concrete, inspectable result in ARI\'s workspace.'],
      status: 'queued',
      createdBy: source === 'ari' ? 'ari' : 'owner',
      parentId: parent?.id || null,
      depth,
      maxSteps: boundedInteger(input.maxSteps, 12, 4, 48),
      wakeAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      completionSummary: null,
      steps: []
    };
    this.state.objectives.push(objective);
    this.recordEvent('objective.created', objective.id, ownerKey, { createdBy: objective.createdBy, parentId: objective.parentId }, false);
    this.persist();
    return clone(objective);
  }

  listObjectives(ownerKey) {
    return this.state.objectives.filter(item => item.ownerKey === ownerKey)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(clone);
  }

  getObjective(ownerKey, id) {
    const objective = this.state.objectives.find(item => item.id === id && item.ownerKey === ownerKey);
    if (!objective) throw runtimeError(404, 'ARI objective was not found.');
    return objective;
  }

  nextRunnable() {
    if (this.state.runtime.paused) return null;
    const timestamp = Date.now();
    return this.state.objectives
      .filter(item => ['queued', 'waiting'].includes(item.status) && Date.parse(item.wakeAt) <= timestamp)
      .sort((left, right) => left.wakeAt.localeCompare(right.wakeAt) || left.createdAt.localeCompare(right.createdAt))[0] || null;
  }

  transition(objective, status, detail = {}) {
    objective.status = status;
    objective.updatedAt = now();
    if (detail.wakeAt) objective.wakeAt = detail.wakeAt;
    if (detail.completionSummary !== undefined) objective.completionSummary = detail.completionSummary;
    this.recordEvent(`objective.${status}`, objective.id, objective.ownerKey, detail, false);
    this.persist();
    return clone(objective);
  }

  addStep(objective, step) {
    const value = {
      sequence: objective.steps.length + 1,
      startedAt: step.startedAt || now(),
      completedAt: now(),
      action: step.action,
      toolId: step.toolId || null,
      status: step.status,
      reason: String(step.reason || '').slice(0, 1_000),
      input: compactValue(step.input),
      output: compactValue(step.output)
    };
    objective.steps.push(value);
    objective.updatedAt = value.completedAt;
    this.recordEvent('objective.step', objective.id, objective.ownerKey, {
      sequence: value.sequence, action: value.action, toolId: value.toolId, status: value.status
    }, false);
    this.persist();
    return clone(value);
  }

  addLesson(objective, consequence, lesson, nextAttempt = null, reversible = true) {
    const value = {
      id: crypto.randomUUID(), objectiveId: objective.id, ownerKey: objective.ownerKey,
      consequence: String(consequence || '').slice(0, 2_000),
      lesson: String(lesson || '').slice(0, 2_000),
      nextAttempt: nextAttempt ? String(nextAttempt).slice(0, 2_000) : null,
      reversible: reversible === true, createdAt: now()
    };
    this.state.lessons.push(value);
    this.recordEvent('lesson.recorded', objective.id, objective.ownerKey, { lessonId: value.id, reversible: value.reversible }, false);
    this.persist();
    return clone(value);
  }

  lessonsFor(ownerKey, objectiveId = null) {
    const branchIds = objectiveId ? new Set(this.branchObjectiveIds(ownerKey, objectiveId)) : null;
    return this.state.lessons.filter(item => item.ownerKey === ownerKey && (!branchIds || branchIds.has(item.objectiveId))).map(clone);
  }

  controlObjective(ownerKey, id, action) {
    const objective = this.getObjective(ownerKey, id);
    if (action === 'pause' && ACTIVE_STATUSES.has(objective.status)) return this.transition(objective, 'paused');
    if (action === 'resume' && objective.status === 'paused') return this.transition(objective, 'queued', { wakeAt: now() });
    if (action === 'wake' && ['waiting', 'queued'].includes(objective.status)) return this.transition(objective, 'queued', { wakeAt: now() });
    if (action === 'cancel' && ACTIVE_STATUSES.has(objective.status)) return this.transition(objective, 'cancelled');
    throw runtimeError(409, `ARI objective cannot ${action} from status ${objective.status}.`);
  }

  recentEvents(ownerKey, limit = 40) {
    return this.state.events.filter(item => item.ownerKey === ownerKey || item.ownerKey === 'system').slice(-limit).map(clone);
  }

  recordEvent(type, objectiveId, ownerKey, detail = {}, persist = true) {
    const event = { id: crypto.randomUUID(), type, objectiveId, ownerKey, at: now(), detail: compactValue(detail) };
    this.state.events.push(event);
    this.state.events = this.state.events.slice(-500);
    this.state.eventCount += 1;
    appendFileSync(this.journalPath, `${JSON.stringify(event)}\n`, 'utf8');
    if (persist) this.persist();
    return event;
  }

  persist() {
    const temporary = `${this.snapshotPath}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    renameSync(temporary, this.snapshotPath);
  }

  branchObjectiveIds(ownerKey, objectiveId) {
    const ids = [];
    let current = this.getObjective(ownerKey, objectiveId);
    while (current) {
      ids.push(current.id);
      current = current.parentId ? this.state.objectives.find(item => item.id === current.parentId && item.ownerKey === ownerKey) : null;
    }
    return ids;
  }
}

function emptyState() {
  const timestamp = now();
  return { version: 'ari-independent-state.v1', runtime: { paused: false, startedAt: timestamp, updatedAt: timestamp }, objectives: [], lessons: [], events: [], eventCount: 0 };
}

function normalizeState(value) {
  const base = emptyState();
  return {
    ...base, ...value,
    runtime: { ...base.runtime, ...(value?.runtime || {}) },
    objectives: Array.isArray(value?.objectives) ? value.objectives : [],
    lessons: Array.isArray(value?.lessons) ? value.lessons : [],
    events: Array.isArray(value?.events) ? value.events.slice(-500) : [],
    eventCount: Number.isSafeInteger(value?.eventCount) ? value.eventCount : 0
  };
}

function compactValue(value) {
  if (value === undefined) return null;
  const raw = JSON.stringify(value);
  if (raw.length <= 12_000) return JSON.parse(raw);
  return { truncated: true, preview: raw.slice(0, 11_500), originalBytes: Buffer.byteLength(raw) };
}

function boundedText(value, name, maximum) {
  const text = String(value || '').normalize('NFC').trim();
  if (!text) throw runtimeError(400, `${name} is required.`);
  if ([...text].length > maximum) throw runtimeError(413, `${name} exceeds ${maximum} Unicode code points.`);
  return text;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function clone(value) { return structuredClone(value); }
function now() { return new Date().toISOString(); }
export function runtimeError(status, message) { return Object.assign(new Error(message), { status }); }
