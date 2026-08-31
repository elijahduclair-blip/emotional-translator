import { describe, expect, it } from 'vitest';
import { resolveConversationTurn, validateSpokenCandidate } from '../MirrorRuntime';

describe('open expression then closed ARI validation', () => {
  it('links an answered preference question to the promised recommendation task', () => {
    const turn = resolveConversationTurn([
      { sequence: 12, role: 'user', content: 'do you know any books?' },
      { sequence: 13, role: 'assistant', content: 'Would you like suggestions in a specific genre or topic?' }
    ], 'yes i would. something gothic');

    expect(turn).toEqual(expect.objectContaining({
      kind: 'answer_supplies_requested_preference',
      mustAdvance: true,
      pendingTask: 'provide_requested_recommendations_now'
    }));
    expect(turn.instruction).toContain('Provide concrete recommendations now');
  });

  it('treats a request for different recommendations as a distinct-answer obligation', () => {
    const turn = resolveConversationTurn([
      { sequence: 23, role: 'assistant', content: "I recommend 'Frankenstein' by Mary Shelley. Would you like more suggestions?" },
      { sequence: 24, role: 'user', content: 'fourth time is the charm?' },
      { sequence: 25, role: 'assistant', content: "I recommend 'Frankenstein' by Mary Shelley. Would you like more suggestions?" }
    ], 'i would like different ones.');

    expect(turn).toEqual(expect.objectContaining({
      kind: 'requests_distinct_alternative',
      mustAdvance: true,
      pendingTask: 'provide_distinct_alternative_now'
    }));
    expect(turn.instruction).toContain('genuinely different answer');
  });

  it('rejects the exact echo that followed observation 14', () => {
    const validation = validateSpokenCandidate({
      candidate: 'ARI: "Yes, I would. Something gothic."',
      currentStatement: 'yes i would. something gothic',
      conversationEvents: [],
      relationalGraph: { sourceLayer: 'unresolved', matchedNodes: [], supportedRoutes: [] },
      inspectionRequested: false
    });

    expect(validation.status).toBe('rejected');
    expect(validation.reasons).toContain('echoes_current_statement');
    expect(validation.adjustments).toEqual(['removed_role_prefix', 'removed_whole_reply_quotation']);
  });

  it('rejects an answer that opens by quoting the question, but accepts a useful answer', () => {
    const repeated = validateSpokenCandidate({
      candidate: 'ARI: "What would you recommend?" I can suggest gothic literature.',
      currentStatement: 'what would you recommend',
      conversationEvents: [],
      relationalGraph: { sourceLayer: 'unresolved', matchedNodes: [], supportedRoutes: [] },
      inspectionRequested: false
    });
    const useful = validateSpokenCandidate({
      candidate: 'Start with Frankenstein by Mary Shelley, then try Dracula by Bram Stoker and The Haunting of Hill House by Shirley Jackson.',
      currentStatement: 'what would you recommend',
      conversationEvents: [],
      relationalGraph: { sourceLayer: 'unresolved', matchedNodes: [], supportedRoutes: [] },
      inspectionRequested: false
    });

    expect(repeated.status).toBe('rejected');
    expect(repeated.reasons).toContain('opens_by_repeating_current_statement');
    expect(useful.status).toBe('accepted');
  });

  it('rejects the repeated Frankenstein answer shown after observations 24 and 26', () => {
    const conversationEvents = [
      { sequence: 23, role: 'assistant', content: "I recommend 'Frankenstein' by Mary Shelley. It's a classic gothic novel that explores themes of science, horror, and the consequences of playing God. Would you like more suggestions?" },
      { sequence: 24, role: 'user', content: 'fourth time is the charm?' },
      { sequence: 25, role: 'assistant', content: "I recommend 'Frankenstein' by Mary Shelley. It's a classic gothic novel that explores themes of science, horror, and the consequences of playing God. Would you like more suggestions?" },
      { sequence: 26, role: 'user', content: 'i would like different ones.' }
    ];
    const repeated = validateSpokenCandidate({
      candidate: "I recommend 'Frankenstein' by Mary Shelley. It's a classic gothic novel that explores themes of science, horror, and the consequences of playing God. Would you like more suggestions?",
      currentStatement: 'i would like different ones.',
      conversationEvents,
      relationalGraph: { sourceLayer: 'unresolved', matchedNodes: [], supportedRoutes: [] },
      inspectionRequested: false
    });
    const different = validateSpokenCandidate({
      candidate: 'Try The Haunting of Hill House by Shirley Jackson; it is psychological gothic horror centered on a troubled house and the people drawn into it.',
      currentStatement: 'i would like different ones.',
      conversationEvents,
      relationalGraph: { sourceLayer: 'unresolved', matchedNodes: [], supportedRoutes: [] },
      inspectionRequested: false
    });

    expect(repeated.status).toBe('rejected');
    expect(repeated.reasons).toContain('repeats_prior_assistant_response');
    expect(different.status).toBe('accepted');
  });

  it('keeps internal receipts out of ordinary conversation', () => {
    const validation = validateSpokenCandidate({
      candidate: 'The comparison ledger and Braille trace confirm my response.',
      currentStatement: 'hello ari',
      conversationEvents: [],
      relationalGraph: { sourceLayer: 'unresolved', matchedNodes: [], supportedRoutes: [] },
      inspectionRequested: false
    });

    expect(validation.status).toBe('rejected');
    expect(validation.reasons).toContain('narrates_internal_process');
  });

  it('canonicalizes natural dash typography before the reversible UEB trace', () => {
    const validation = validateSpokenCandidate({
      candidate: 'Hi. I\u2019m here\u2014what\u2019s on your mind\u2026',
      currentStatement: 'hello',
      conversationEvents: [],
      relationalGraph: { sourceLayer: 'unresolved', matchedNodes: [], supportedRoutes: [] },
      inspectionRequested: false
    });

    expect(validation.status).toBe('accepted');
    expect(validation.text).toBe('Hi. I\u2019m here - what\u2019s on your mind...');
    expect(validation.adjustments).toContain('canonicalized_ueb_punctuation');
  });
});
