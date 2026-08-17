import { describe, expect, it } from 'vitest';
import { ComparisonEngine } from '../subsystems/ComparisonEngine';

describe('ARI comparison engine', () => {
  it('selects relevant earlier person observations and records exact recurrence without inventing meaning', () => {
    const ledger = new ComparisonEngine().compare('Comparison reveals a repeated relationship.', [
      { sequence: 1, interactionId: 'turn-0001', role: 'user', content: 'The color compass has fixed anchors.' },
      { sequence: 2, interactionId: 'turn-0001', role: 'assistant', content: 'I can explain the compass.' },
      { sequence: 3, interactionId: 'turn-0002', role: 'user', content: 'Comparison can reveal a relationship.' },
      { sequence: 4, interactionId: 'turn-0003', role: 'user', content: 'The microphone is working.' }
    ], 5);

    expect(ledger.version).toBe('ari-comparison.v1');
    expect(ledger.selection.availablePersonObservations).toBe(3);
    expect(ledger.comparisons[0].observationSequence).toBe(3);
    expect(ledger.comparisons[0].dimensions.sharedTokens).toEqual(expect.arrayContaining(['comparison', 'relationship']));
    expect(ledger.recurringLanguage.tokens.map(item => item.value)).toEqual(expect.arrayContaining(['comparison', 'relationship']));
    expect(ledger.boundary.comparisonCreatesMeaning).toBe(false);
    expect(ledger.boundary.graphMutationAllowed).toBe(false);
    expect(ledger.boundary.automaticLearningAllowed).toBe(false);
  });

  it('keeps substitutions, insertions, and deletions accountable in a deterministic ledger', () => {
    const substitution = new ComparisonEngine().compare('CAT', [
      { sequence: 1, interactionId: 'turn-0001', role: 'user', content: 'BAT' }
    ], 2);
    expect(substitution.comparisons[0].differences).toEqual([{
      type: 'substitution', priorPosition: 1, currentPosition: 1, priorToken: 'bat', currentToken: 'cat'
    }]);

    const insertion = new ComparisonEngine().compare('compare the color', [
      { sequence: 1, interactionId: 'turn-0001', role: 'user', content: 'compare color' }
    ], 2);
    expect(insertion.comparisons[0].differences).toContainEqual({
      type: 'insertion', priorPosition: null, currentPosition: 2, priorToken: null, currentToken: 'the'
    });

    const deletion = new ComparisonEngine().compare('compare color', [
      { sequence: 1, interactionId: 'turn-0001', role: 'user', content: 'compare the color' }
    ], 2);
    expect(deletion.comparisons[0].differences).toContainEqual({
      type: 'deletion', priorPosition: 2, currentPosition: null, priorToken: 'the', currentToken: null
    });
  });

  it('bounds comparisons and token work while preserving an explicit truncation receipt', () => {
    const events = Array.from({ length: 12 }, (_, index) => ({
      sequence: index + 1,
      interactionId: `turn-${String(index + 1).padStart(4, '0')}`,
      role: 'user',
      content: `observation ${index + 1} ${'word '.repeat(160)}`
    }));
    const ledger = new ComparisonEngine().compare(`current ${'word '.repeat(160)}`, events, 13, true);

    expect(ledger.comparisons).toHaveLength(5);
    expect(ledger.currentObservation.tokenCount).toBeGreaterThan(128);
    expect(ledger.currentObservation.tokensTruncated).toBe(true);
    expect(ledger.selection.contextTruncated).toBe(true);
    expect(ledger.selection.maximumTokensPerObservation).toBe(128);
  });

  it('returns an identified observation without pretending comparison occurred when history is empty', () => {
    const ledger = new ComparisonEngine().compare('First observation', [], 1);
    expect(ledger.comparisons).toEqual([]);
    expect(ledger.summary.strongestObservationSequence).toBeNull();
    expect(ledger.summary.notice).toContain('No earlier person observation');
  });
});
