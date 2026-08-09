import { describe, expect, it } from 'vitest';
import { inventionLabels, normalizeInventionProposal } from '../MirrorRuntime';

describe('governed invention proposals', () => {
  it('grounds candidate labels in supplied graph records and meaningful input words', () => {
    const labels = inventionLabels('What pressure moves through reflection?', {
      matchedNodes: [{ id: 'amber-glow', label: 'Amber Glow' }]
    });
    expect(labels).toEqual(['Amber Glow', 'pressure', 'moves', 'reflection']);
  });

  it('accepts one falsifiable low-confidence route using grounded labels', () => {
    const proposal = normalizeInventionProposal({
      sourceIndex: 0, targetIndex: 1, relationshipType: 'moves_toward',
      evidence: 'Both labels occur in the unresolved language.',
      counterexample: 'Reject when reviewed interactions consistently place them in separate climates.',
      confidence: 'low'
    }, ['pressure', 'reflection']);
    expect(proposal).toEqual(expect.objectContaining({
      source: 'pressure', target: 'reflection', relationshipType: 'moves_toward', confidence: 'low'
    }));
  });

  it('rejects invented labels and high-confidence claims instead of promoting them', () => {
    expect(() => normalizeInventionProposal({
      sourceIndex: 0, targetIndex: 2, relationshipType: 'creates', evidence: 'Maybe.',
      counterexample: 'Reject if absent.', confidence: 'low'
    }, ['pressure', 'reflection'])).toThrow('outside the grounded invention set');
    expect(() => normalizeInventionProposal({
      sourceIndex: 0, targetIndex: 1, relationshipType: 'creates', evidence: 'Maybe.',
      counterexample: 'Reject if absent.', confidence: 'high'
    }, ['pressure', 'reflection'])).toThrow('low or medium');
  });
});
