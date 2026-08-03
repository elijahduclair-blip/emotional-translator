/**
 * In-memory test harness for the Honest Conversation service.
 *
 * Provides injectable stores, a deterministic clock, the service interface,
 * a minimal ledger + semantic snapshot (so the conversation/ledger boundary
 * can be asserted without the full graph), and a runConversation script runner.
 */
import {
  applyAbandon,
  applyCommitFailure,
  applyCommitMemory,
  applyOpenConflict,
  applyPresentMirror,
  applyResolveConflict,
  applyRevisitAffirm,
  applyRevisitDefer,
  applyRespondToProposal,
  applySelectDisposition,
  applySubmitClarification,
  applySubmitObservation,
  derivePendingAction,
  reduceSession,
  StaleSessionVersionError,
  type CommandResult,
  type ConversationEvent,
  type ConversationEventInput,
  type HonestConversationSession,
  type MemoryDisposition,
  type MirrorProposal,
  type ReconciliationResolution,
  type RevisitTrigger,
  type ConflictCandidate,
  type ContextEntry,
  type LedgerCommand,
} from "../../base44/shared/honestConversation";

// ── Ledger event (in-memory; free-form type) ────────────────────────

export interface LedgerEvent {
  id: string;
  conceptId: string;
  type: string;
  payload: Record<string, any>;
  streamVersion: number;
  occurredAt: string;
  idempotencyKey?: string;
}

// ── Semantic snapshot (test-facing) ──────────────────────────────────

export interface HonestMemorySnapshot {
  conceptId: string;
  current: {
    proposition: string;
    lifecycle: string;
    userConfirmed: boolean;
    supportingEvidence: { evidenceId: string }[];
    contexts: ContextEntry[];
  };
  unresolvedConflicts: ConflictCandidate[];
  history: { type: string; payload: Record<string, any> }[];
}

const emptySnapshot = (conceptId: string): HonestMemorySnapshot => ({
  conceptId,
  current: {
    proposition: "",
    lifecycle: "uncertain",
    userConfirmed: false,
    supportingEvidence: [],
    contexts: [],
  },
  unresolvedConflicts: [],
  history: [],
});

// ── Service interface ────────────────────────────────────────────────

export interface CommitResult {
  status: "committed" | "conflict" | "invalid";
  conceptId?: string;
  streamVersion?: number;
  reason?: string;
  session: HonestConversationSession;
}

export interface HonestConversationService {
  startObservationSession(input: { userId: string }): Promise<HonestConversationSession>;
  startRevisitSession(input: {
    conceptId: string;
    trigger: RevisitTrigger;
    userId?: string;
  }): Promise<HonestConversationSession>;
  submitObservation(input: {
    sessionId: string;
    expectedVersion: number;
    text: string;
  }): Promise<HonestConversationSession>;
  presentMirror(input: {
    sessionId: string;
    expectedVersion: number;
    proposal: MirrorProposal;
  }): Promise<HonestConversationSession>;
  respondToProposal(input: {
    sessionId: string;
    expectedVersion: number;
    response:
      | { type: "confirm" }
      | { type: "clarify"; text?: string }
      | { type: "reject" };
  }): Promise<HonestConversationSession>;
  submitClarification(input: {
    sessionId: string;
    expectedVersion: number;
    text: string;
  }): Promise<HonestConversationSession>;
  selectDisposition(input: {
    sessionId: string;
    expectedVersion: number;
    disposition: MemoryDisposition;
  }): Promise<HonestConversationSession>;
  commitMemory(input: {
    sessionId: string;
    expectedVersion: number;
    idempotencyKey: string;
  }): Promise<CommitResult>;
  openConflict(input: {
    sessionId: string;
    expectedVersion: number;
    conflict: ConflictCandidate;
  }): Promise<HonestConversationSession>;
  resolveConflict(input: {
    sessionId: string;
    expectedVersion: number;
    resolution: ReconciliationResolution;
    explanation?: string;
    contexts?: ContextEntry[];
    newProposition?: string;
  }): Promise<HonestConversationSession>;
  affirmRevisit(input: {
    sessionId: string;
    expectedVersion: number;
    conceptId: string;
  }): Promise<HonestConversationSession>;
  deferRevisit(input: {
    sessionId: string;
    expectedVersion: number;
  }): Promise<HonestConversationSession>;
  abandon(input: { sessionId: string; expectedVersion: number }): Promise<HonestConversationSession>;
}

// ── Harness factory ──────────────────────────────────────────────────

export interface Harness {
  service: HonestConversationService;
  conceptEventStore: LedgerEvent[];
  conversationEventStore: ConversationEvent[];
  proposalStore: Map<string, MirrorProposal>;
  observationStore: Map<string, string>;
  generateSemanticSnapshot: (conceptId: string) => HonestMemorySnapshot;
  runConversation: (steps: ConversationStep[]) => HonestConversationSession;
  freshProposal: (over?: Partial<MirrorProposal>) => MirrorProposal;
  freshConflict: (over?: Partial<ConflictCandidate>) => ConflictCandidate;
  completedSessionFor: (conceptId: string) => Promise<HonestConversationSession>;
  // test hooks
  failNextCommit: () => void;
  setConceptIdForNextCommit: (id: string) => void;
}

export type ConversationStep =
  | { cmd: "startObservation"; userId?: string }
  | { cmd: "submitObservation"; text: string }
  | { cmd: "presentMirror"; proposal: MirrorProposal }
  | { cmd: "respond"; response: { type: "confirm" } | { type: "clarify"; text?: string } | { type: "reject" } }
  | { cmd: "submitClarification"; text: string }
  | { cmd: "selectDisposition"; disposition: MemoryDisposition }
  | { cmd: "commit"; idempotencyKey: string }
  | { cmd: "startRevisit"; conceptId: string; trigger: RevisitTrigger }
  | { cmd: "openConflict"; conflict: ConflictCandidate }
  | { cmd: "resolve"; resolution: ReconciliationResolution; explanation?: string; contexts?: ContextEntry[]; newProposition?: string }
  | { cmd: "affirm"; conceptId: string }
  | { cmd: "defer" };

export function setup(): Harness {
  const conceptEventStore: LedgerEvent[] = [];
  const conversationEventStore: ConversationEvent[] = [];
  const proposalStore = new Map<string, MirrorProposal>();
  const observationStore = new Map<string, string>();
  const idempotencyResults = new Map<string, CommitResult>();
  let eventCounter = 0;
  let ledgerCounter = 0;
  let observationCounter = 0;
  let proposalCounter = 0;
  let conceptCounter = 0;
  let failNext = false;
  let forcedConceptId: string | null = null;

  const now = () => new Date().toISOString();
  const nextEventId = () => `evt-${++eventCounter}`;
  const nextLedgerId = () => `ledger-${++ledgerCounter}`;
  const nextConceptId = () => forcedConceptId ?? `concept-${++conceptCounter}`;

  // ── load / append conversation events ─────────────────────────────
  function eventsFor(sessionId: string): ConversationEvent[] {
    return conversationEventStore.filter((e) => e.sessionId === sessionId);
  }

  function loadSession(sessionId: string): HonestConversationSession {
    return reduceSession(sessionId, eventsFor(sessionId));
  }

  function appendConversation(
    sessionId: string,
    inputs: ConversationEventInput[]
  ): HonestConversationSession {
    let version = eventsFor(sessionId).length;
    for (const input of inputs) {
      conversationEventStore.push({
        id: nextEventId(),
        sessionId,
        type: input.type,
        payload: input.payload,
        occurredAt: now(),
        streamVersion: version,
      });
      version += 1;
    }
    return reduceSession(sessionId, eventsFor(sessionId));
  }

  function checkVersion(session: HonestConversationSession, expected: number) {
    if (session.version !== expected) {
      throw new StaleSessionVersionError({
        sessionId: session.sessionId,
        expected,
        actual: session.version,
      });
    }
  }

  // ── ledger mutation ───────────────────────────────────────────────
  function appendLedger(conceptId: string, type: string, payload: Record<string, any>, idempotencyKey?: string): LedgerEvent {
    const existing = idempotencyKey
      ? conceptEventStore.find((e) => e.idempotencyKey === idempotencyKey)
      : undefined;
    if (existing) return existing;
    const ev: LedgerEvent = {
      id: nextLedgerId(),
      conceptId,
      type,
      payload,
      streamVersion: conceptEventStore.filter((e) => e.conceptId === conceptId).length + 1,
      occurredAt: now(),
      idempotencyKey,
    };
    conceptEventStore.push(ev);
    return ev;
  }

  function executeLedgerCommand(cmd: LedgerCommand): { conceptId: string; ledgerEvent: LedgerEvent } | { failed: true; reason: string } {
    if (cmd.kind === "commit_concept") {
      if (failNext) {
        failNext = false;
        return { failed: true, reason: "ledger_append_failed" };
      }
      const conceptId = nextConceptId();
      const lifecycle = cmd.disposition === "ongoing" ? "stable" : "emerging";
      const ledgerEvent = appendLedger(
        conceptId,
        "concept.committed",
        {
          proposition: cmd.proposal.inference,
          observationIds: cmd.proposal.observationIds,
          evidenceExcerpts: cmd.proposal.evidenceExcerpts,
          initialLifecycle: lifecycle,
          disposition: cmd.disposition,
          sessionId: cmd.sessionId,
          dispositionEventId: cmd.dispositionEventId,
        },
        `commit:${cmd.sessionId}:${cmd.proposal.proposalId}`
      );
      forcedConceptId = null;
      return { conceptId, ledgerEvent };
    }
    if (cmd.kind === "open_conflict") {
      appendLedger(cmd.conceptId, "conflict.opened", {
        conflictId: cmd.conflict.conflictId,
        earlierEvidenceIds: cmd.conflict.earlierEvidenceIds,
        newerEvidenceIds: cmd.conflict.newerEvidenceIds,
        explanation: cmd.conflict.explanation,
        confidence: cmd.conflict.confidence,
      });
      return { conceptId: cmd.conceptId, ledgerEvent: conceptEventStore[conceptEventStore.length - 1] };
    }
    if (cmd.kind === "reaffirm") {
      const ledgerEvent = appendLedger(cmd.conceptId, "concept.reaffirmed", {
        conceptId: cmd.conceptId,
        conflictId: cmd.conflictId,
        sessionId: cmd.sessionId,
      });
      if (cmd.conflictId) {
        appendLedger(cmd.conceptId, "conflict.resolved", { conflictId: cmd.conflictId });
      }
      return { conceptId: cmd.conceptId, ledgerEvent };
    }
    // reconcile
    const { conceptId, conflictId, resolution, explanation, contexts, newProposition } = cmd;
    appendLedger(conceptId, "conflict.resolved", { conflictId, resolution });
    switch (resolution) {
      case "affirmed":
        appendLedger(conceptId, "concept.reaffirmed", { conflictId });
        break;
      case "revised":
        appendLedger(conceptId, "concept.revised", { conceptId, newProposition });
        break;
      case "contextualized":
        appendLedger(conceptId, "concept.context_added", { contexts: contexts ?? [], explanation });
        break;
      case "coexisting":
        appendLedger(conceptId, "concept.coexisting", { conflictId });
        break;
      case "uncertain":
        // Do NOT resolve the conflict — keep it unresolved.
        appendLedger(conceptId, "conflict.marked_unresolved", { conflictId, explanation });
        // re-open: remove the earlier conflict.resolved effect by recording an open marker
        appendLedger(conceptId, "conflict.opened", { conflictId, explanation });
        break;
      case "rejected":
        appendLedger(conceptId, "concept.rejected", { conceptId });
        break;
    }
    return { conceptId, ledgerEvent: conceptEventStore[conceptEventStore.length - 1] };
  }

  // ── service ──────────────────────────────────────────────────────
  const service: HonestConversationService = {
    async startObservationSession({ userId }) {
      const sessionId = `session-${++eventCounter}`;
      appendConversation(sessionId, [
        { type: "session.started", payload: { userId, phase: "observe" } },
      ]);
      return loadSession(sessionId);
    },

    async startRevisitSession({ conceptId, trigger, userId }) {
      const sessionId = `session-${++eventCounter}`;
      appendConversation(sessionId, [
        {
          type: "session.started",
          payload: { userId: userId ?? "user", phase: "revisit", relatedConceptId: conceptId, revisitTrigger: trigger },
        },
      ]);
      appendConversation(sessionId, [{ type: "review.invited", payload: { conceptId, trigger } }]);
      return loadSession(sessionId);
    },

    async submitObservation({ sessionId, expectedVersion, text }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      const observationId = `obs-${++observationCounter}`;
      observationStore.set(observationId, text);
      const result = applySubmitObservation(session, { observationId, text });
      return appendConversation(sessionId, result.conversationEvents);
    },

    async presentMirror({ sessionId, expectedVersion, proposal }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      proposalStore.set(proposal.proposalId, proposal);
      const result = applyPresentMirror(session, { proposal });
      return appendConversation(sessionId, result.conversationEvents);
    },

    async respondToProposal({ sessionId, expectedVersion, response }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      const result = applyRespondToProposal(session, { response });
      return appendConversation(sessionId, result.conversationEvents);
    },

    async submitClarification({ sessionId, expectedVersion, text }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      const observationId = `obs-${++observationCounter}`;
      observationStore.set(observationId, text);
      const result = applySubmitClarification(session, { text });
      return appendConversation(sessionId, result.conversationEvents);
    },

    async selectDisposition({ sessionId, expectedVersion, disposition }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      const result = applySelectDisposition(session, { disposition });
      return appendConversation(sessionId, result.conversationEvents);
    },

    async commitMemory({ sessionId, expectedVersion, idempotencyKey }) {
      const cached = idempotencyResults.get(idempotencyKey);
      if (cached) return cached;

      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      if (!session.disposition || session.disposition === "transient" || session.disposition === "do_not_remember") {
        throw new Error("No explicit persistent disposition");
      }
      const proposal = session.activeProposalId
        ? proposalStore.get(session.activeProposalId)
        : undefined;
      if (!proposal) throw new Error("No active proposal to commit");

      const conceptId = nextConceptId();
      const { ledgerCommand, successEvents } = applyCommitMemory(session, {
        proposal,
        idempotencyKey,
        conceptId,
      });

      const outcome = executeLedgerCommand(ledgerCommand);
      if ("failed" in outcome) {
        const failResult = applyCommitFailure(session);
        const failedSession = appendConversation(sessionId, failResult.conversationEvents);
        const result: CommitResult = { status: "conflict", reason: outcome.reason, session: failedSession };
        idempotencyResults.set(idempotencyKey, result);
        return result;
      }

      const committedConceptId = outcome.conceptId;
      const updated = appendConversation(sessionId, [
        { type: "memory.committed", payload: { conceptId: committedConceptId, proposalId: proposal.proposalId, idempotencyKey } },
      ]);
      const result: CommitResult = {
        status: "committed",
        conceptId: committedConceptId,
        streamVersion: conceptEventStore.filter((e) => e.conceptId === committedConceptId).length,
        session: updated,
      };
      idempotencyResults.set(idempotencyKey, result);
      return result;
    },

    async openConflict({ sessionId, expectedVersion, conflict }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      const result = applyOpenConflict(session, { conflict });
      if (result.ledgerCommand) executeLedgerCommand(result.ledgerCommand);
      return appendConversation(sessionId, result.conversationEvents);
    },

    async resolveConflict({ sessionId, expectedVersion, resolution, explanation, contexts, newProposition }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      const conceptId = session.relatedConceptId ?? "";
      const result = applyResolveConflict(session, {
        resolution,
        explanation,
        contexts,
        newProposition,
        conceptId,
      });
      if (result.ledgerCommand) executeLedgerCommand(result.ledgerCommand);
      return appendConversation(sessionId, result.conversationEvents);
    },

    async affirmRevisit({ sessionId, expectedVersion, conceptId }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      const result = applyRevisitAffirm(session, { conceptId });
      if (result.ledgerCommand) executeLedgerCommand(result.ledgerCommand);
      return appendConversation(sessionId, result.conversationEvents);
    },

    async deferRevisit({ sessionId, expectedVersion }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      const result = applyRevisitDefer(session);
      return appendConversation(sessionId, result.conversationEvents);
    },

    async abandon({ sessionId, expectedVersion }) {
      const session = loadSession(sessionId);
      checkVersion(session, expectedVersion);
      const result = applyAbandon(session);
      return appendConversation(sessionId, result.conversationEvents);
    },
  };

  // ── semantic snapshot from ledger ─────────────────────────────────
  function generateSemanticSnapshot(conceptId: string): HonestMemorySnapshot {
    const events = conceptEventStore.filter((e) => e.conceptId === conceptId);
    const snap = emptySnapshot(conceptId);
    snap.history = events.map((e) => ({ type: e.type, payload: e.payload }));

    for (const e of events) {
      switch (e.type) {
        case "concept.committed":
          snap.current.proposition = e.payload.proposition;
          snap.current.lifecycle = e.payload.initialLifecycle;
          snap.current.userConfirmed = true;
          snap.current.supportingEvidence = (e.payload.observationIds || []).map((id: string) => ({ evidenceId: id }));
          break;
        case "conflict.opened":
          snap.unresolvedConflicts.push({
            conflictId: e.payload.conflictId,
            conceptId,
            earlierEvidenceIds: e.payload.earlierEvidenceIds || [],
            newerEvidenceIds: e.payload.newerEvidenceIds || [],
            explanation: e.payload.explanation || "",
            confidence: e.payload.confidence ?? 0,
          });
          snap.current.lifecycle = "contested";
          break;
        case "conflict.resolved":
          snap.unresolvedConflicts = snap.unresolvedConflicts.filter((c) => c.conflictId !== e.payload.conflictId);
          break;
        case "concept.context_added":
          for (const c of e.payload.contexts || []) snap.current.contexts.push(c);
          snap.current.lifecycle = "evolving";
          break;
        case "concept.revised":
          if (e.payload.newProposition) snap.current.proposition = e.payload.newProposition;
          snap.current.lifecycle = "evolving";
          break;
        case "concept.reaffirmed":
          snap.current.lifecycle = "stable";
          break;
        case "concept.rejected":
          snap.current.lifecycle = "superseded";
          snap.current.userConfirmed = false;
          break;
        case "concept.coexisting":
          snap.current.lifecycle = "evolving";
          break;
        default:
          break;
      }
    }
    return snap;
  }

  // ── runConversation script runner ─────────────────────────────────
  async function runConversation(steps: ConversationStep[]): Promise<HonestConversationSession> {
    let current: HonestConversationSession | null = null;
    let revisitSession: HonestConversationSession | null = null;
    const observationSteps = ["submitObservation", "presentMirror", "respond", "submitClarification", "selectDisposition", "commit"];
    for (const step of steps) {
      if (!current && !revisitSession && observationSteps.includes(step.cmd)) {
        current = await service.startObservationSession({ userId: "user" });
      }
      const sid = () => (revisitSession ?? current!)!.sessionId;
      switch (step.cmd) {
        case "startObservation":
          current = await (service.startObservationSession({ userId: step.userId ?? "user" }));
          revisitSession = null;
          break;
        case "submitObservation":
          current = await (service.submitObservation({ sessionId: sid(), expectedVersion: current!.version, text: step.text }));
          break;
        case "presentMirror":
          current = await (service.presentMirror({ sessionId: sid(), expectedVersion: current!.version, proposal: step.proposal }));
          break;
        case "respond":
          current = await (service.respondToProposal({ sessionId: sid(), expectedVersion: current!.version, response: step.response }));
          break;
        case "submitClarification":
          current = await (service.submitClarification({ sessionId: sid(), expectedVersion: current!.version, text: step.text }));
          break;
        case "selectDisposition":
          current = await (service.selectDisposition({ sessionId: sid(), expectedVersion: current!.version, disposition: step.disposition }));
          break;
        case "commit": {
          const res = await (service.commitMemory({ sessionId: sid(), expectedVersion: current!.version, idempotencyKey: step.idempotencyKey }));
          current = res.session;
          break;
        }
        case "startRevisit":
          revisitSession = await (service.startRevisitSession({ conceptId: step.conceptId, trigger: step.trigger }));
          break;
        case "openConflict":
          revisitSession = await (service.openConflict({ sessionId: revisitSession!.sessionId, expectedVersion: revisitSession!.version, conflict: step.conflict }));
          break;
        case "resolve":
          revisitSession = await (service.resolveConflict({ sessionId: revisitSession!.sessionId, expectedVersion: revisitSession!.version, resolution: step.resolution, explanation: step.explanation, contexts: step.contexts, newProposition: step.newProposition }));
          break;
        case "affirm":
          revisitSession = await (service.affirmRevisit({ sessionId: revisitSession!.sessionId, expectedVersion: revisitSession!.version, conceptId: step.conceptId }));
          break;
        case "defer":
          revisitSession = await (service.deferRevisit({ sessionId: revisitSession!.sessionId, expectedVersion: revisitSession!.version }));
          break;
      }
    }
    return revisitSession ?? current!;
  }

  function freshProposal(over: Partial<MirrorProposal> = {}): MirrorProposal {
    const id = `proposal-${++proposalCounter}`;
    return {
      proposalId: id,
      observationIds: over.observationIds ?? [],
      observationSummary: over.observationSummary ?? "",
      inference: over.inference ?? "An inference",
      evidenceExcerpts: over.evidenceExcerpts ?? [],
      uncertainty: over.uncertainty ?? [],
      confidence: over.confidence,
      revision: over.revision ?? 1,
    };
  }

  function freshConflict(over: Partial<ConflictCandidate> = {}): ConflictCandidate {
    return {
      conflictId: over.conflictId ?? `conflict-${++eventCounter}`,
      conceptId: over.conceptId ?? "concept-x",
      earlierEvidenceIds: over.earlierEvidenceIds ?? [],
      newerEvidenceIds: over.newerEvidenceIds ?? [],
      explanation: over.explanation ?? "Newer evidence may contradict the earlier memory.",
      confidence: over.confidence ?? 0.7,
    };
  }

  async function completedSessionFor(conceptId: string): Promise<HonestConversationSession> {
    const session = await service.startObservationSession({ userId: "user" });
    await service.submitObservation({ sessionId: session.sessionId, expectedVersion: 0, text: "seed observation" });
    const proposal = freshProposal({ observationIds: ["obs-seed"], inference: "seed concept" });
    await service.presentMirror({ sessionId: session.sessionId, expectedVersion: 1, proposal });
    await service.respondToProposal({ sessionId: session.sessionId, expectedVersion: 2, response: { type: "confirm" } });
    await service.selectDisposition({ sessionId: session.sessionId, expectedVersion: 3, disposition: "emerging" });
    const res = await service.commitMemory({ sessionId: session.sessionId, expectedVersion: 4, idempotencyKey: `seed-${conceptId}` });
    return res.session;
  }

  return {
    service,
    conceptEventStore,
    conversationEventStore,
    proposalStore,
    observationStore,
    generateSemanticSnapshot,
    runConversation,
    freshProposal,
    freshConflict,
    completedSessionFor,
    failNextCommit: () => { failNext = true; },
    setConceptIdForNextCommit: (id: string) => { forcedConceptId = id; },
  };
}