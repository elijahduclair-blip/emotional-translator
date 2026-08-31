export class IndependentAriRuntime {
  constructor({ store, planner, toolkit, intervalMs = 3_000, retryMs = 30_000 }) {
    this.store = store;
    this.planner = planner;
    this.toolkit = toolkit;
    this.intervalMs = intervalMs;
    this.retryMs = retryMs;
    this.timer = null;
    this.inFlight = false;
  }

  start() {
    this.store.initialize();
    if (!this.timer) this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref?.();
    void this.runOnce();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async health() {
    return {
      version: 'ari-independent-runtime.v1', status: 'ready', scheduler: this.inFlight ? 'working' : 'awake',
      state: this.store.status(), planner: await this.planner.health(),
      perimeter: {
        interior: ['objective_queue', 'append_only_journal', 'lesson_memory', 'runtime_workspace', 'bounded_garden_reads', 'followup_objectives'],
        external: ['cross_person_data', 'credentials', 'security_or_permission_changes', 'public_actions', 'source_code_changes', 'shared_or_personal_graph_mutation']
      }
    };
  }

  async runOnce() {
    if (this.inFlight) return false;
    const objective = this.store.nextRunnable();
    if (!objective) return false;
    this.inFlight = true;
    this.store.transition(objective, 'running');
    const startedAt = new Date().toISOString();
    try {
      if (objective.steps.length >= objective.maxSteps) {
        this.store.transition(objective, 'step_limit', { completionSummary: 'ARI reached this branch step limit. The journal and lessons remain available for a follow-up objective.' });
        return true;
      }
      const planningContext = {
        runtime: 'independent', objective: objective.objective, successCriteria: objective.successCriteria,
        stepsRemaining: objective.maxSteps - objective.steps.length,
        priorSteps: objective.steps.slice(-12), lessons: this.store.lessonsFor(objective.ownerKey, objective.id).slice(-12),
        workspaceArtifacts: await this.toolkit.execute('workspace.list', {}, objective), tools: this.toolkit.definitions()
      };
      const decision = await this.planner.decide(planningContext);
      if (decision.action === 'use_tool') {
        try {
          const output = await this.toolkit.execute(decision.toolId, decision.input, objective);
          this.store.addStep(objective, { startedAt, action: 'use_tool', toolId: decision.toolId, status: 'completed', reason: decision.reason, input: decision.input, output });
          this.store.transition(objective, objective.steps.length >= objective.maxSteps ? 'step_limit' : 'queued', {
            wakeAt: new Date().toISOString(),
            ...(objective.steps.length >= objective.maxSteps ? { completionSummary: 'ARI reached the objective step limit after a completed tool action.' } : {})
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool failed.';
          this.store.addStep(objective, { startedAt, action: 'use_tool', toolId: decision.toolId, status: 'failed', reason: decision.reason, input: decision.input, output: { error: message } });
          this.store.addLesson(objective, message, `Do not repeat the same ${decision.toolId} call unchanged; revise the input or choose another route.`, 'Inspect the consequence before the next attempt.', true);
          this.store.transition(objective, 'waiting', { wakeAt: new Date(Date.now() + this.retryMs).toISOString() });
        }
        return true;
      }
      if (decision.action === 'spawn_followup') {
        if (!decision.followupObjective) throw new Error('ARI did not supply the follow-up objective.');
        this.store.addStep(objective, { startedAt, action: 'spawn_followup', status: 'completed', reason: decision.reason, input: {}, output: { followupObjective: decision.followupObjective } });
        const child = this.store.createObjective(objective.ownerKey, {
          objective: decision.followupObjective, successCriteria: objective.successCriteria, maxSteps: objective.maxSteps
        }, 'ari', objective.id);
        this.store.transition(objective, 'completed', { completionSummary: decision.completionSummary || `ARI formed follow-up objective ${child.id}.` });
        return true;
      }
      if (decision.action === 'wait') {
        this.store.addStep(objective, { startedAt, action: 'wait', status: 'completed', reason: decision.reason, input: {}, output: { wakeAfterSeconds: decision.wakeAfterSeconds } });
        this.store.transition(objective, 'waiting', { wakeAt: new Date(Date.now() + decision.wakeAfterSeconds * 1_000).toISOString() });
        return true;
      }
      const successfulToolSteps = objective.steps.filter(step => step.action === 'use_tool' && step.status === 'completed');
      const review = successfulToolSteps.length
        ? await this.planner.evaluateCompletion(planningContext, decision.completionSummary)
        : {
            satisfied: false,
            reason: 'Completion has no successful tool evidence. ARI cannot use its own summary as proof of work.',
            unmetCriteria: objective.successCriteria
          };
      if (!review.satisfied) {
        this.store.addStep(objective, {
          startedAt, action: 'completion_review', status: 'failed', reason: review.reason, input: { proposedSummary: decision.completionSummary }, output: review
        });
        this.store.addLesson(
          objective,
          `Completion was rejected: ${review.reason}`,
          `Do not declare completion until these criteria are inspectably satisfied: ${review.unmetCriteria.join('; ') || 'the stated success criteria'}.`,
          'Revise the artifact or use another tool, then request a fresh completion review.',
          true
        );
        this.store.transition(objective, objective.steps.length >= objective.maxSteps ? 'step_limit' : 'queued', { wakeAt: new Date().toISOString() });
        return true;
      }
      this.store.addStep(objective, { startedAt, action: 'complete', status: 'completed', reason: decision.reason, input: {}, output: { summary: decision.completionSummary, review } });
      this.store.transition(objective, 'completed', { completionSummary: decision.completionSummary || 'ARI completed the objective.' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Planner failed.';
      this.store.addStep(objective, { startedAt, action: 'plan', status: 'failed', reason: 'ARI could not produce the next runnable decision.', input: {}, output: { error: message } });
      this.store.addLesson(objective, message, 'A temporary planning failure is a dependency consequence, not proof that the objective is impossible.', 'Wake and plan again after the local model is available.', true);
      this.store.transition(objective, objective.steps.length >= objective.maxSteps ? 'step_limit' : 'waiting', {
        wakeAt: new Date(Date.now() + this.retryMs).toISOString()
      });
      return true;
    } finally {
      this.inFlight = false;
    }
  }
}
