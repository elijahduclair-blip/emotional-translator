import { describe, expect, it } from 'vitest';
import { AriAutonomyEngine, AriAutonomyDecision } from '../subsystems/AriAutonomyEngine';
import { AriToolRegistry } from '../subsystems/AriToolRegistry';

function readyRegistry() {
  const registry = new AriToolRegistry();
  for (const toolId of ['mira.read-private-context', 'cora.compare-ordered-language', 'cara.place-personal-relationship']) {
    registry.bind(toolId, () => ({
      output: { toolId, privateWords: 'ephemeral only' },
      evidence: { sourceLayer: 'test', summary: `${toolId} completed.`, itemCount: 1 }
    }));
  }
  return registry;
}

describe('ARI bounded autonomy', () => {
  it('selects complementary tools and completes without per-step confirmation', async () => {
    const registry = readyRegistry();
    const engine = new AriAutonomyEngine(registry);
    const decisions: AriAutonomyDecision[] = [
      { action: 'use_tool', toolId: 'mira.read-private-context', reason: 'Read ordered context.', completionSummary: '' },
      { action: 'use_tool', toolId: 'cora.compare-ordered-language', reason: 'Compare the context.', completionSummary: '' },
      { action: 'complete', toolId: null, reason: 'The two sources satisfy the objective.', completionSummary: 'The objective completed with context and comparison.' }
    ];
    const persisted: any[] = [];
    const result = await engine.run({
      state: {
        id: 'objective-1', objective: 'Understand repetition.', successCriteria: ['Use context and comparison'],
        status: 'active', maxSteps: 6,
        allowedTools: ['mira.read-private-context', 'cora.compare-ordered-language'], steps: [], lessons: []
      },
      authenticatedAccount: true,
      planner: async () => decisions.shift()!,
      buildToolInput: toolId => ({ toolId }),
      persistStep: async step => { persisted.push(step); }
    });

    expect(result.status).toBe('completed');
    expect(persisted.map(step => step.action)).toEqual(['use_tool', 'use_tool', 'complete']);
    expect(persisted.slice(0, 2).every(step => step.receipt.access.ownerConfirmationUsed === false)).toBe(true);
    expect(persisted.slice(0, 2).every(step => step.receipt.access.writeScopes.length === 0)).toBe(true);
  });

  it('refuses to place a personal relationship even when requested as an allowed tool', async () => {
    const engine = new AriAutonomyEngine(readyRegistry());
    await expect(engine.run({
      state: {
        id: 'objective-2', objective: 'Change the graph.', successCriteria: [], status: 'active', maxSteps: 4,
        allowedTools: ['mira.read-private-context', 'cara.place-personal-relationship'], steps: [], lessons: []
      },
      authenticatedAccount: true,
      planner: async () => ({ action: 'use_tool', toolId: 'cara.place-personal-relationship', reason: 'mutate', completionSummary: '' }),
      buildToolInput: () => ({}),
      persistStep: async () => undefined
    })).rejects.toThrow(/two ready, complementary read-only tools/);
  });

  it('records premature completion as a lesson instead of treating it as harm', async () => {
    const persisted: any[] = [];
    const engine = new AriAutonomyEngine(readyRegistry());
    const result = await engine.run({
      state: {
        id: 'objective-3', objective: 'Finish immediately.', successCriteria: [], status: 'active', maxSteps: 4,
        allowedTools: ['mira.read-private-context', 'cora.compare-ordered-language'], steps: [], lessons: []
      },
      authenticatedAccount: true,
      planner: async () => ({ action: 'complete', toolId: null, reason: 'done', completionSummary: 'done' }),
      buildToolInput: () => ({}),
      persistStep: async step => { persisted.push(step); }
    });
    expect(result.status).toBe('step_limit');
    expect(persisted).toHaveLength(4);
    expect(persisted.every(step => step.observation.sourceLayer === 'ari_learning_receipt')).toBe(true);
  });

  it('honors an owner pause after the in-flight tool finishes', async () => {
    const engine = new AriAutonomyEngine(readyRegistry());
    const result = await engine.run({
      state: {
        id: 'objective-4', objective: 'Pause safely.', successCriteria: [], status: 'active', maxSteps: 6,
        allowedTools: ['mira.read-private-context', 'cora.compare-ordered-language'], steps: [], lessons: []
      },
      authenticatedAccount: true,
      planner: async () => ({ action: 'use_tool', toolId: 'mira.read-private-context', reason: 'read', completionSummary: '' }),
      buildToolInput: () => ({}),
      persistStep: async () => undefined,
      shouldContinue: async () => false
    });
    expect(result.status).toBe('paused');
    expect(result.steps).toHaveLength(1);
  });

  it('lets a failed tool attempt become context for a revised retry', async () => {
    const registry = readyRegistry();
    let attempts = 0;
    registry.bind('mira.read-private-context', () => {
      attempts += 1;
      if (attempts === 1) throw new Error('first attempt failed');
      return {
        output: { recovered: true },
        evidence: { sourceLayer: 'test', summary: 'MIRA recovered on the revised attempt.', itemCount: 1 }
      };
    });
    const decisions: AriAutonomyDecision[] = [
      { action: 'use_tool', toolId: 'mira.read-private-context', reason: 'Try the context route.', completionSummary: '' },
      { action: 'use_tool', toolId: 'mira.read-private-context', reason: 'Revise after the failed consequence.', completionSummary: '' },
      { action: 'use_tool', toolId: 'cora.compare-ordered-language', reason: 'Add a complementary comparison.', completionSummary: '' },
      { action: 'complete', toolId: null, reason: 'The revised route worked.', completionSummary: 'Recovered and completed.' }
    ];
    const plannerLessons: any[] = [];
    const result = await new AriAutonomyEngine(registry).run({
      state: {
        id: 'objective-5', objective: 'Learn from a failed attempt.', successCriteria: [], status: 'active', maxSteps: 6,
        allowedTools: ['mira.read-private-context', 'cora.compare-ordered-language'], steps: [],
        lessons: [{ classification: 'mistake', consequence: 'The first route failed.', lesson: 'Revise and retry.', reversible: true }]
      },
      authenticatedAccount: true,
      planner: async context => { plannerLessons.push(context.lessons); return decisions.shift()!; },
      buildToolInput: () => ({}),
      persistStep: async () => undefined
    });
    expect(result.status).toBe('completed');
    expect(result.steps.map(step => step.status)).toEqual(['failed', 'completed', 'completed', 'completed']);
    expect(plannerLessons[0][0].lesson).toBe('Revise and retry.');
  });
});
