/**
 * Constitutional harness — wires the REAL shared modules end to end.
 *
 *   honestConversation (pure state machine)
 *     → SemanticMutationService (the boundary)
 *       → enforced SemanticEventStore (second line of defense)
 *         → ConceptEvent reducer (durable projection)
 *
 * Unlike test/lib/harness.ts (which writes free-form LedgerEvents directly,
 * bypassing the boundary), this harness routes every commit through the real
 * SemanticMutationService so the constitutional boundary is exercised exactly
 * as production would exercise it.
 */
import {
  createSemanticMutationService,
  createEnforcedSemanticEventStore,
  UnauthorizedSemanticAppendError,
  type SemanticEvent,
  type SemanticEventStore,
  type SemanticMutationService,
  type SemanticMutation,
  type CommitResult,
} from "../../base44/shared/semanticMutationBoundary";
import {
  reduceConceptEvents,
  type ConceptEvent,
  type PersistentConceptProjection,
} from "../../base44/shared/conceptEvents";
import {
  applySubmitObservation,
  applyPresentMirror,
  applyRespondToProposal,
  applySelectDisposition,
  reduceSession,
  type HonestConversationSession,
  type MirrorProposal,
  type MemoryDisposition,
  type ConversationEvent,
  type ConversationEventInput,
} from "../../base44/shared/honestConversation";

// ── Durable-but-non-authoritative records (persist, but carry no meaning) ──

export interface Evidence {
  id: string;
  content: string;
  sourceType: string;
  observedAt: string;
}
export interface Hypothesis {
  id: string;
  proposition: string;
  evidenceId: string;
  status: string;
}

// ── Prepared commit (the package that crosses the boundary) ─────────────────

export interface PreparedCommit {
  mutation: SemanticMutation;
  authorization: { sessionId: string; userDecisionEventId: string; idempotencyKey: string };
  provenance: { evidenceIds: string[]; authorizerId: string };
  expectedStreamVersion: number;
}

export interface CommitOutcome {
  status: "committed";
  event: SemanticEvent;
  provenance: {
    sessionId: string;
    userDecisionEventId: string;
    evidenceIds: string[];
    authorizedBy: string;
    authorizationSource: string;
  };
}

// ── Event store view (what the tests assert against) ────────────────────────

export interface EventStoreView {
  semanticEvents(): SemanticEvent[];
  persistentConcepts(): PersistentConceptProjection[];
  /** Direct append through the enforced store — rejects anything unauthorized. */
  appendSemanticEvent(event: any): Promise<SemanticEvent>;
}

export interface ConversationCoordinator {
  observeAndHypothesize(input: { text: string }): Promise<{ id: string; observation: Evidence; hypothesis: Hypothesis }>;
  startSession(input: { evidenceRecordId: string }): Promise<any>;
  presentMirror(sessionId: string, over?: Partial<MirrorProposal>): Promise<any>;
  clarify(sessionId: string, text: string): Promise<any>;
  respondToProposal(sessionId: string, response: any): Promise<any>;
  selectDisposition(sessionId: string, disposition: MemoryDisposition): Promise<{ eventId: string; session: any }>;
  prepareCommit(sessionId: string): Promise<PreparedCommit>;
  commitMemory(command: PreparedCommit): Promise<CommitOutcome>;
  getSession(sessionId: string): any;
}

export interface ConstitutionalHarness {
  eventStore: EventStoreView;
  mutationService: SemanticMutationService;
  conversation: ConversationCoordinator;
  evidenceRecords: Evidence[];
  hypotheses: Hypothesis[];
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createConstitutionalHarness(): ConstitutionalHarness {
  const semanticEvents: SemanticEvent[] = [];
  const conceptEvents: ConceptEvent[] = [];
  const projections = new Map<string, PersistentConceptProjection>();
  const evidenceRecords: Evidence[] = [];
  const hypotheses: Hypothesis[] = [];
  const conversationEvents: ConversationEvent[] = [];
  const proposalStore = new Map<string, MirrorProposal>();
  const sessionEvidence = new Map<string, string>();

  let evCounter = 0, convCounter = 0, conceptCounter = 0, proposalCounter = 0, evidenceCounter = 0, hypoCounter = 0;
  const now = () => new Date().toISOString();

  // ── Real in-memory semantic event store (the protected ledger) ──────────
  const innerStore: SemanticEventStore = {
    async append(event) { semanticEvents.push(event); return event; },
    async getStreamVersion(conceptId) { return semanticEvents.filter((e) => e.conceptId === conceptId).length; },
    async findByIdempotencyKey(key) { return semanticEvents.find((e) => e.authorization.idempotencyKey === key) ?? null; },
    async findByAuthorization(sid, udid) {
      return semanticEvents.find((e) => e.authorization.sessionId === sid && e.authorization.userDecisionEventId === udid) ?? null;
    },
  };
  const enforced = createEnforcedSemanticEventStore(innerStore);
  const mutationService = createSemanticMutationService(innerStore, now, () => `evt-${++evCounter}`);

  // ── Concept projection maintenance (translate SemanticEvent → ConceptEvent) ──
  function recordConceptEvent(se: SemanticEvent) {
    const ce: ConceptEvent = {
      id: se.id,
      concept_id: se.conceptId,
      profile_id: "profile-test",
      event_type: "promoted",
      schema_version: "1",
      payload: {
        proposition: se.payload.proposition,
        category: se.payload.category ?? "preference",
        initialConfidence: se.payload.initialConfidence ?? 0.5,
        initialLifecycleStatus: se.payload.initialLifecycleStatus ?? "emerging",
        profileId: "profile-test",
        sourceHypothesisIds: [],
        validFrom: se.appliedAt,
      },
      stream_version: se.streamVersion,
      decision_id: se.authorization.userDecisionEventId,
      policy_version: "1",
      rationale_codes: [],
      evidence_ids: se.evidenceIds,
      hypothesis_ids: [],
      idempotency_key: se.authorization.idempotencyKey,
      applied_at: se.appliedAt,
      created_date: se.appliedAt,
    };
    conceptEvents.push(ce);
    const proj = reduceConceptEvents(se.conceptId, conceptEvents.filter((c) => c.concept_id === se.conceptId), null);
    if (proj) projections.set(se.conceptId, proj);
  }

  // ── Conversation event store helpers ────────────────────────────────────
  function eventsFor(sid: string) { return conversationEvents.filter((e) => e.sessionId === sid); }
  function loadSession(sid: string): HonestConversationSession { return reduceSession(sid, eventsFor(sid)); }
  function appendConversation(sid: string, inputs: ConversationEventInput[]): ConversationEvent[] {
    let version = eventsFor(sid).length;
    const added: ConversationEvent[] = [];
    for (const input of inputs) {
      const ev: ConversationEvent = {
        id: `ce-${++evCounter}`, sessionId: sid, type: input.type,
        payload: input.payload, occurredAt: now(), streamVersion: version,
      };
      conversationEvents.push(ev); added.push(ev); version += 1;
    }
    return added;
  }
  function wrap(sid: string) {
    const s = loadSession(sid);
    return { ...s, id: sid, activeProposal: s.activeProposalId ? proposalStore.get(s.activeProposalId) : undefined };
  }

  // ── Idempotency key derivation (a function of authorization + mutation) ──
  // A different mutation is a different commit; the same authorization reused
  // for a different mutation is a consent-replay violation.
  function deriveKey(auth: { sessionId: string; userDecisionEventId: string }, mutation: SemanticMutation): string {
    return `${auth.sessionId}:${auth.userDecisionEventId}:${mutation.type}:${mutation.conceptId}:${JSON.stringify(mutation.payload ?? {})}`;
  }

  // ── Conversation coordinator ────────────────────────────────────────────
  const conversation: ConversationCoordinator = {
    async observeAndHypothesize({ text }) {
      const evidence: Evidence = { id: `ev-${++evidenceCounter}`, content: text, sourceType: "direct_statement", observedAt: now() };
      evidenceRecords.push(evidence);
      const hypothesis: Hypothesis = { id: `hyp-${++hypoCounter}`, proposition: `Inferred: ${text}`, evidenceId: evidence.id, status: "observed" };
      hypotheses.push(hypothesis);
      return { id: evidence.id, observation: evidence, hypothesis };
    },

    async startSession({ evidenceRecordId }) {
      const sid = `session-${++convCounter}`;
      sessionEvidence.set(sid, evidenceRecordId);
      appendConversation(sid, [{ type: "session.started", payload: { userId: "user", phase: "observe" } }]);
      const ev = evidenceRecords.find((e) => e.id === evidenceRecordId);
      const obsResult = applySubmitObservation(loadSession(sid), { observationId: evidenceRecordId, text: ev?.content ?? "" });
      appendConversation(sid, obsResult.conversationEvents);
      return wrap(sid);
    },

    async presentMirror(sessionId, over = {}) {
      const session = loadSession(sessionId);
      const evidenceId = sessionEvidence.get(sessionId) ?? "";
      const evidence = evidenceRecords.find((e) => e.id === evidenceId);
      const proposal: MirrorProposal = {
        proposalId: `prop-${++proposalCounter}`,
        observationIds: over.observationIds ?? (evidenceId ? [evidenceId] : []),
        observationSummary: over.observationSummary ?? "",
        inference: over.inference ?? "An inferred meaning",
        evidenceExcerpts: over.evidenceExcerpts ?? (evidence ? [{ evidenceId, excerpt: evidence.content }] : []),
        uncertainty: over.uncertainty ?? [],
        confidence: over.confidence,
        revision: over.revision ?? 1,
      };
      proposalStore.set(proposal.proposalId, proposal);
      const result = applyPresentMirror(session, { proposal });
      appendConversation(sessionId, result.conversationEvents);
      return wrap(sessionId);
    },

    async clarify(sessionId, text) {
      const session = loadSession(sessionId);
      const result = applyRespondToProposal(session, { response: { type: "clarify", text } });
      appendConversation(sessionId, result.conversationEvents);
      return wrap(sessionId);
    },

    async respondToProposal(sessionId, response) {
      const session = loadSession(sessionId);
      const result = applyRespondToProposal(session, { response });
      appendConversation(sessionId, result.conversationEvents);
      return wrap(sessionId);
    },

    async selectDisposition(sessionId, disposition) {
      const session = loadSession(sessionId);
      const result = applySelectDisposition(session, { disposition });
      const added = appendConversation(sessionId, result.conversationEvents);
      const dispositionEvent = added.find((e) => e.type === "memory.disposition_selected");
      return { eventId: dispositionEvent?.id ?? `decision-${sessionId}`, session: wrap(sessionId) };
    },

    async prepareCommit(sessionId) {
      const session = loadSession(sessionId);
      const proposal = session.activeProposalId ? proposalStore.get(session.activeProposalId) : undefined;
      if (!proposal) throw new Error("No active proposal to commit");
      const disposition = session.disposition;
      if (!disposition || disposition === "transient" || disposition === "do_not_remember")
        throw new Error("No persistent disposition selected");
      const dispositionEvent = eventsFor(sessionId).find((e) => e.type === "memory.disposition_selected");
      const userDecisionEventId = dispositionEvent?.id ?? `decision-${sessionId}`;
      const evidenceIds = proposal.evidenceExcerpts.map((ee) => ee.evidenceId).filter(Boolean);
      const conceptId = `concept-${++conceptCounter}`;
      const initialLifecycleStatus = disposition === "ongoing" ? "active" : "emerging";
      const mutation: SemanticMutation = {
        type: "promote",
        conceptId,
        payload: { proposition: proposal.inference, category: "identity", initialConfidence: 0.5, initialLifecycleStatus, evidenceIds },
      };
      return {
        mutation,
        authorization: { sessionId, userDecisionEventId, idempotencyKey: "" },
        provenance: { evidenceIds, authorizerId: "user" },
        expectedStreamVersion: 0,
      };
    },

    async commitMemory(command) {
      const idempotencyKey = deriveKey(command.authorization, command.mutation);
      const result: CommitResult = await mutationService.commit({
        mutation: command.mutation,
        conversationSessionId: command.authorization.sessionId,
        userDecisionEventId: command.authorization.userDecisionEventId,
        authorizerId: command.provenance.authorizerId,
        evidenceIds: command.provenance.evidenceIds,
        expectedStreamVersion: command.expectedStreamVersion,
        idempotencyKey,
      });
      if (result.status === "committed") {
        recordConceptEvent(result.event);
        appendConversation(command.authorization.sessionId, [
          { type: "memory.committed", payload: { conceptId: result.event.conceptId, proposalId: result.event.id, idempotencyKey } },
        ]);
      }
      return {
        status: "committed",
        event: result.event,
        provenance: {
          sessionId: result.event.authorization.sessionId,
          userDecisionEventId: result.event.authorization.userDecisionEventId,
          evidenceIds: result.event.evidenceIds,
          authorizedBy: result.event.authorizerId,
          authorizationSource: result.event.authorization.source,
        },
      };
    },

    getSession(sessionId) { return wrap(sessionId); },
  };

  const eventStore: EventStoreView = {
    semanticEvents: () => [...semanticEvents],
    persistentConcepts: () => [...projections.values()],
    appendSemanticEvent: (event) => enforced.append(event),
  };

  return { eventStore, mutationService, conversation, evidenceRecords, hypotheses };
}

export { UnauthorizedSemanticAppendError };