import crypto from 'node:crypto';
import { AriToolReceipt, AriToolRegistry, AriToolTask } from './AriToolRegistry';

export type AriAutonomyStatus = 'active' | 'paused' | 'completed' | 'blocked' | 'cancelled' | 'step_limit';
export type AriAutonomyAction = 'use_tool' | 'complete' | 'block';

export interface AriAutonomyObjectiveState {
  id: string;
  objective: string;
  successCriteria: string[];
  status: AriAutonomyStatus;
  maxSteps: number;
  allowedTools: string[];
  steps: AriAutonomyPersistedStep[];
  lessons: AriAutonomyLesson[];
}

export interface AriAutonomyLesson {
  classification: 'useful' | 'mistake' | 'unexpected' | 'harm';
  consequence: string;
  lesson: string;
  nextAttempt?: string | null;
  reversible: boolean;
}

export interface AriAutonomyPersistedStep {
  sequence: number;
  action: AriAutonomyAction;
  toolId: string | null;
  status: 'completed' | 'rejected' | 'failed';
  reason: string;
  observation?: { sourceLayer?: string; summary?: string; itemCount?: number };
}

export interface AriAutonomyDecision {
  action: AriAutonomyAction;
  toolId: string | null;
  reason: string;
  completionSummary: string;
}

export interface AriAutonomyStepDraft extends AriAutonomyPersistedStep {
  receipt: AriToolReceipt | null;
  observation: { sourceLayer: string; summary: string; itemCount: number };
  objectiveStatus: AriAutonomyStatus;
  completionSummary: string | null;
}

export interface AriAutonomyRunResult {
  status: AriAutonomyStatus;
  steps: AriAutonomyStepDraft[];
  transientToolOutputs: Record<string, unknown>;
}

export interface AriAutonomyRunOptions {
  state: AriAutonomyObjectiveState;
  authenticatedAccount: boolean;
  stepBudget?: number;
  planner: (context: {
    objective: string;
    successCriteria: string[];
    eligibleTools: Array<{ id: string; owner: string; description: string; reads: string[] }>;
    priorSteps: AriAutonomyPersistedStep[];
    remainingSteps: number;
    minimumDistinctToolsBeforeCompletion: number;
    lessons: AriAutonomyLesson[];
    transientToolOutputs: Record<string, unknown>;
  }) => Promise<AriAutonomyDecision>;
  buildToolInput: (toolId: string, transientToolOutputs: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
  persistStep: (step: AriAutonomyStepDraft) => Promise<void>;
  shouldContinue?: () => Promise<boolean>;
}

export class AriAutonomyEngine {
  constructor(private readonly registry: AriToolRegistry) {}

  async run(options: AriAutonomyRunOptions): Promise<AriAutonomyRunResult> {
    if (!options.authenticatedAccount) throw autonomyError(401, 'Bounded autonomy requires an authenticated owner account.');
    if (options.state.status !== 'active') throw autonomyError(409, 'Only an active objective can run autonomously.');
    const eligibleTools = this.eligibleTools(options.state.allowedTools);
    if (eligibleTools.length < 2) throw autonomyError(400, 'Bounded autonomy requires at least two ready, complementary read-only tools.');

    const existingSteps = [...(options.state.steps || [])];
    const transientToolOutputs: Record<string, unknown> = {};
    const steps: AriAutonomyStepDraft[] = [];
    const remainingAtStart = Math.max(0, options.state.maxSteps - existingSteps.length);
    const budget = Math.min(Math.max(1, Number(options.stepBudget || remainingAtStart)), remainingAtStart);
    if (!budget) throw autonomyError(409, 'This objective has exhausted its authorized step budget.');

    let status: AriAutonomyStatus = 'active';
    for (let offset = 0; offset < budget && status === 'active'; offset += 1) {
      const priorSteps = [...existingSteps, ...steps];
      const remainingSteps = options.state.maxSteps - priorSteps.length;
      const completedTools = new Set(
        priorSteps.filter(step => step.action === 'use_tool' && step.status === 'completed' && step.toolId).map(step => step.toolId as string)
      );
      const decision = normalizeDecision(await options.planner({
        objective: options.state.objective,
        successCriteria: options.state.successCriteria,
        eligibleTools,
        priorSteps,
        remainingSteps,
        minimumDistinctToolsBeforeCompletion: Math.max(0, 2 - completedTools.size),
        lessons: [...options.state.lessons],
        transientToolOutputs
      }));
      const sequence = priorSteps.length + 1;

      if (decision.action === 'complete') {
        if (completedTools.size < 2) {
          const correction = learningStep(
            sequence,
            'ARI tried to finish before consulting two complementary tools. This attempt is recorded as a lesson, not treated as harm.',
            sequence >= options.state.maxSteps ? 'step_limit' : 'active'
          );
          await options.persistStep(correction);
          steps.push(correction);
          status = correction.objectiveStatus;
          continue;
        }
        const completed: AriAutonomyStepDraft = {
          sequence,
          action: 'complete',
          toolId: null,
          status: 'completed',
          reason: decision.reason,
          observation: { sourceLayer: 'ari_objective_audit', summary: decision.completionSummary, itemCount: completedTools.size },
          receipt: null,
          objectiveStatus: 'completed',
          completionSummary: decision.completionSummary
        };
        await options.persistStep(completed);
        steps.push(completed);
        status = 'completed';
        break;
      }

      if (decision.action === 'block') {
        const blocked = boundaryStep(sequence, decision.reason || 'ARI reported that the objective cannot continue within its jurisdiction.', 'blocked');
        await options.persistStep(blocked);
        steps.push(blocked);
        status = 'blocked';
        break;
      }

      const definition = eligibleTools.find(tool => tool.id === decision.toolId);
      if (!definition) {
        const blocked = boundaryStep(sequence, `ARI selected a tool outside the objective jurisdiction: ${decision.toolId || 'none'}.`, 'blocked');
        await options.persistStep(blocked);
        steps.push(blocked);
        status = 'blocked';
        break;
      }
      if (completedTools.has(definition.id)) {
        const correction = learningStep(
          sequence,
          `ARI repeated ${definition.id} without a fresh attempt boundary. The consequence is preserved so the next decision can choose a different route.`,
          sequence >= options.state.maxSteps ? 'step_limit' : 'active'
        );
        await options.persistStep(correction);
        steps.push(correction);
        status = correction.objectiveStatus;
        continue;
      }

      const task: AriToolTask = {
        interactionId: `autonomy-${options.state.id}-${sequence}-${crypto.randomUUID()}`,
        requestedBy: 'ARI',
        toolId: definition.id,
        objective: options.state.objective,
        input: await options.buildToolInput(definition.id, transientToolOutputs),
        authorization: {
          authenticatedAccount: true,
          ownerConfirmed: false,
          requestedReads: definition.reads,
          requestedWrites: []
        }
      };
      const invocation = await this.registry.invoke(task);
      if (invocation.output !== null) transientToolOutputs[definition.id] = invocation.output;
      const isLastAuthorizedStep = sequence >= options.state.maxSteps;
      const step: AriAutonomyStepDraft = {
        sequence,
        action: 'use_tool',
        toolId: definition.id,
        status: invocation.receipt.status,
        reason: decision.reason,
        observation: {
          sourceLayer: String(invocation.receipt.evidence?.sourceLayer || 'unresolved'),
          summary: String(invocation.receipt.evidence?.summary || invocation.receipt.error || 'Tool returned no evidence summary.'),
          itemCount: Number(invocation.receipt.evidence?.itemCount || 0)
        },
        receipt: invocation.receipt,
        objectiveStatus: isLastAuthorizedStep ? 'step_limit' : 'active',
        completionSummary: isLastAuthorizedStep ? 'ARI reached the owner-authorized step limit without declaring completion.' : null
      };
      await options.persistStep(step);
      steps.push(step);
      status = step.objectiveStatus;
      if (status === 'active' && options.shouldContinue && !(await options.shouldContinue())) {
        status = 'paused';
      }
    }

    return { status, steps, transientToolOutputs };
  }

  private eligibleTools(allowedTools: string[]) {
    const allowed = new Set(allowedTools);
    return this.registry.snapshot().tools
      .filter(tool => allowed.has(tool.id) && tool.execution === 'server' && tool.status === 'ready' && tool.permissions.writes.length === 0)
      .map(tool => ({
        id: tool.id,
        owner: tool.owner,
        description: tool.description,
        reads: [...tool.permissions.reads]
      }));
  }
}

function normalizeDecision(value: AriAutonomyDecision): AriAutonomyDecision {
  const action = value?.action;
  if (!['use_tool', 'complete', 'block'].includes(action)) throw autonomyError(502, 'ARI planner returned an invalid action.');
  return {
    action,
    toolId: action === 'use_tool' ? String(value.toolId || '').trim() || null : null,
    reason: String(value.reason || '').trim().slice(0, 500) || 'ARI selected the next bounded step.',
    completionSummary: String(value.completionSummary || '').trim().slice(0, 1_000)
      || (action === 'complete' ? 'ARI completed the bounded objective.' : '')
  };
}

function boundaryStep(sequence: number, reason: string, status: 'blocked'): AriAutonomyStepDraft {
  return {
    sequence,
    action: 'block',
    toolId: null,
    status: 'rejected',
    reason: String(reason).slice(0, 500),
    observation: { sourceLayer: 'ari_authority_boundary', summary: String(reason).slice(0, 1_000), itemCount: 0 },
    receipt: null,
    objectiveStatus: status,
    completionSummary: String(reason).slice(0, 1_000)
  };
}

function learningStep(sequence: number, reason: string, objectiveStatus: 'active' | 'step_limit'): AriAutonomyStepDraft {
  return {
    sequence,
    action: 'block',
    toolId: null,
    status: 'rejected',
    reason: String(reason).slice(0, 500),
    observation: { sourceLayer: 'ari_learning_receipt', summary: String(reason).slice(0, 1_000), itemCount: 1 },
    receipt: null,
    objectiveStatus,
    completionSummary: objectiveStatus === 'step_limit'
      ? 'ARI reached the authorized step limit with an unresolved lesson. The attempt can be reviewed and retried.'
      : null
  };
}

function autonomyError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}
