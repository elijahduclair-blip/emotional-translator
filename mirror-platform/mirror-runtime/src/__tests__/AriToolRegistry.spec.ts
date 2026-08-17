import { describe, expect, it } from 'vitest';
import { ARI_TEAM, AriToolRegistry } from '../subsystems/AriToolRegistry';

describe('ARI Tool Registry', () => {
  it('publishes every acronym role with ARI as the only coordinator', () => {
    const registry = new AriToolRegistry();
    const snapshot = registry.snapshot();

    expect(snapshot.version).toBe('ari-tool-registry.v1');
    expect(snapshot.team.map(member => member.id)).toEqual(['ARI', 'LEA', 'CORA', 'CARA', 'MIRA', 'VERA', 'FEN', 'AURA']);
    expect(snapshot.team.filter(member => member.coordinator).map(member => member.id)).toEqual(['ARI']);
    expect(snapshot.counts.members).toBe(ARI_TEAM.length);
    expect(snapshot.tools.every(tool => tool.owner !== 'ARI')).toBe(true);
    expect(snapshot.boundary.sharedGraphMutationAllowed).toBe(false);
  });

  it('returns a content-free receipt for a bounded read-only tool', async () => {
    const registry = new AriToolRegistry();
    registry.bind('cora.compare-ordered-language', input => ({
      output: { compared: true, secretInput: input.text },
      evidence: { sourceLayer: 'ordered_observations', summary: 'One comparison completed.', itemCount: 1 }
    }));

    const invocation = await registry.invoke<{ compared: boolean }>({
      interactionId: 'interaction-1',
      requestedBy: 'ARI',
      toolId: 'cora.compare-ordered-language',
      objective: 'Compare two ordered statements.',
      input: { text: 'private words' },
      authorization: {
        authenticatedAccount: true,
        ownerConfirmed: false,
        requestedReads: ['current_statement', 'supplied_observations'],
        requestedWrites: []
      }
    });

    expect(invocation.output).toEqual({ compared: true, secretInput: 'private words' });
    expect(invocation.receipt.status).toBe('completed');
    expect(invocation.receipt.teamMember).toBe('CORA');
    expect(invocation.receipt.access.writeScopes).toEqual([]);
    expect(JSON.stringify(invocation.receipt)).not.toContain('private words');
    expect(invocation.receipt.boundary.sourceMutationAllowed).toBe(false);
  });

  it('rejects a personal graph write until authentication and owner confirmation are both present', async () => {
    const registry = new AriToolRegistry();
    let calls = 0;
    registry.bind('cara.place-personal-relationship', () => {
      calls += 1;
      return {
        output: { placed: true },
        evidence: { sourceLayer: 'user_graph', summary: 'Private relationship placed.', itemCount: 1 }
      };
    });
    const baseTask = {
      interactionId: 'interaction-2',
      requestedBy: 'ARI' as const,
      toolId: 'cara.place-personal-relationship',
      objective: 'Place the owner reviewed relationship.',
      input: { relationship: { source: 'flow', target: 'Gray' } },
      authorization: {
        authenticatedAccount: false,
        ownerConfirmed: false,
        requestedReads: ['personal_graph'],
        requestedWrites: ['personal_graph']
      }
    };

    const unauthenticated = await registry.invoke(baseTask);
    expect(unauthenticated.receipt.status).toBe('rejected');
    expect(unauthenticated.receipt.error).toContain('authenticated account');

    const unconfirmed = await registry.invoke({
      ...baseTask,
      authorization: { ...baseTask.authorization, authenticatedAccount: true }
    });
    expect(unconfirmed.receipt.status).toBe('rejected');
    expect(unconfirmed.receipt.error).toContain('explicit owner confirmation');

    const completed = await registry.invoke({
      ...baseTask,
      authorization: { ...baseTask.authorization, authenticatedAccount: true, ownerConfirmed: true }
    });
    expect(completed.receipt.status).toBe('completed');
    expect(completed.receipt.access.writeScopes).toEqual(['personal_graph']);
    expect(calls).toBe(1);
  });

  it('rejects undeclared access scopes before a handler can run', async () => {
    const registry = new AriToolRegistry();
    let called = false;
    registry.bind('fen.trace-language', () => {
      called = true;
      return {
        output: { traced: true },
        evidence: { sourceLayer: 'codex_foundation', summary: 'Trace complete.' }
      };
    });

    const invocation = await registry.invoke({
      interactionId: 'interaction-3',
      requestedBy: 'ARI',
      toolId: 'fen.trace-language',
      objective: 'Trace language.',
      input: { text: 'hello' },
      authorization: {
        authenticatedAccount: false,
        ownerConfirmed: false,
        requestedReads: ['another_person_transcript'],
        requestedWrites: []
      }
    });

    expect(invocation.receipt.status).toBe('rejected');
    expect(invocation.receipt.error).toContain('cannot read scope');
    expect(called).toBe(false);
  });

  it('keeps AURA browser-managed and rejects server invocation', async () => {
    const registry = new AriToolRegistry();
    const invocation = await registry.invoke({
      interactionId: 'interaction-4',
      requestedBy: 'ARI',
      toolId: 'aura.capture-speech',
      objective: 'Capture speech while the visible microphone control is enabled.',
      input: {},
      authorization: {
        authenticatedAccount: false,
        ownerConfirmed: true,
        requestedReads: ['microphone_stream'],
        requestedWrites: []
      }
    });

    expect(invocation.receipt.status).toBe('rejected');
    expect(invocation.receipt.error).toContain('controlled by the browser');
    expect(registry.snapshot().tools.find(tool => tool.owner === 'AURA')?.status).toBe('client_managed');
  });
});
