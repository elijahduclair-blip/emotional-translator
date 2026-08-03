/**
 * Honest Conversation Session — interaction coordinator.
 *
 * This module owns ONLY the interaction flow. It never owns semantic truth.
 * The epistemic ledger (ConceptEvent stream) is the only place semantic state
 * may be written, and only after an explicit, successful commit or reconciliation.
 *
 * Boundary contract:
 *   - Conversation events record that an interaction occurred.
 *   - Ledger commands are emitted ONLY at commit / reconciliation boundaries.
 *   - No provisional proposal, confirmation, or disposition becomes a concept
 *     until the commit transaction succeeds.
 *
 * "Every memory is an invitation, never a verdict."
 */

// ── Phases ──────────────────────────────────────────────────────────

export type HonestConversationPhase =
  | "observe"
  | "mirror"
  | "propose"
  | "clarify"
  | "consent"
  | "commit"
  | "revisit"
  | "reconcile"
  | "complete"
  | "abandoned";

export type MemoryDisposition =
  | "transient"
  | "emerging"
  | "ongoing"
  | "do_not_remember";

export type ReconciliationResolution =
  | "affirmed"
  | "revised"
  | "contextualized"
  | "coexisting"
  | "uncertain"
  | "rejected";

export type RevisitTrigger =
  | "contradictory_evidence"
  | "user_requested_review"
  | "context_change"
  | "low_reinforcement"
  | "scheduled_reflection";

// ── Proposals & evidence ─────────────────────────────────────────────

export interface EvidenceReference {
  evidenceId: string;
  excerpt: string;
}

export interface MirrorProposal {
  proposalId: string;
  observationIds: string[];
  observationSummary: string;
  inference: string;
  evidenceExcerpts: EvidenceReference[];
  uncertainty: string[];
  confidence?: number;
  revision: number;
}

export interface ConflictCandidate {
  conflictId: string;
  conceptId: string;
  earlierEvidenceIds: string[];
  newerEvidenceIds: string[];
  explanation: string;
  confidence: number;
}

export interface ContextEntry {
  context: string;
  interpretation: string;
}

// ── Session projection ───────────────────────────────────────────────

export type PendingAction =
  | { type: "provide_observation" }
  | { type: "present_mirror" }
  | { type: "confirm_mirror"; proposalId: string }
  | { type: "provide_clarification"; proposalId: string }
  | { type: "choose_disposition"; proposalId: string }
  | { type: "confirm_commit"; proposalId: string; disposition: MemoryDisposition }
  | { type: "resolve_conflict"; conflictId: string };

export interface HonestConversationSession {
  sessionId: string;
  userId: string;
  phase: HonestConversationPhase;
  version: number;

  observationIds: string[];
  activeProposalId?: string;
  supersededProposalIds: string[];
  disposition?: MemoryDisposition;

  pendingAction?: PendingAction;

  relatedConceptId?: string;
  relatedConflictId?: string;
  revisitTrigger?: RevisitTrigger;

  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ── Conversation events (UX history — NOT semantic) ──────────────────

export type ConversationEventType =
  | "session.started"
  | "observation.submitted"
  | "mirror.presented"
  | "clarification.requested"
  | "clarification.provided"
  | "proposal.superseded"
  | "proposal.confirmed"
  | "proposal.rejected"
  | "consent.requested"
  | "memory.disposition_selected"
  | "memory.marked_transient"
  | "memory.declined"
  | "memory.committed"
  | "memory.commit_failed"
  | "review.invited"
  | "conflict.opened"
  | "conflict.resolved"
  | "revisit.affirmed"
  | "revisit.deferred"
  | "session.completed"
  | "session.abandoned";

export interface ConversationEvent {
  id: string;
  sessionId: string;
  type: ConversationEventType;
  payload: Record<string, any>;
  occurredAt: string;
  streamVersion: number;
}

export interface ConversationEventInput {
  type: ConversationEventType;
  payload: Record<string, any>;
}

// ── Ledger command (the only thing that may mutate the ledger) ────────

export type LedgerCommand =
  | {
      kind: "commit_concept";
      proposal: MirrorProposal;
      disposition: MemoryDisposition;
      sessionId: string;
      dispositionEventId: string;
      occurredAt: string;
    }
  | {
      kind: "reconcile";
      conceptId: string;
      conflictId: string;
      resolution: ReconciliationResolution;
      explanation?: string;
      contexts?: ContextEntry[];
      newProposition?: string;
      sessionId: string;
      occurredAt: string;
    }
  | { kind: "reaffirm"; conceptId: string; conflictId?: string; sessionId: string; occurredAt: string }
  | { kind: "open_conflict"; conflict: ConflictCandidate; conceptId: string; sessionId: string; occurredAt: string };

export interface CommandResult {
  conversationEvents: ConversationEventInput[];
  ledgerCommand?: LedgerCommand;
}

// ── Transition table ─────────────────────────────────────────────────

export type SessionAction =
  | "submit_observation"
  | "present_mirror"
  | "confirm"
  | "clarify"
  | "reject"
  | "submit_clarification"
  | "select_disposition"
  | "commit_succeeded"
  | "commit_failed"
  | "open_conflict"
  | "affirm"
  | "defer"
  | "resolve_conflict"
  | "abandon";

export const ALLOWED_ACTIONS: Record<HonestConversationPhase, SessionAction[]> = {
  observe: ["submit_observation", "abandon"],
  mirror: ["submit_observation", "present_mirror", "abandon"],
  propose: ["confirm", "clarify", "reject", "abandon"],
  clarify: ["submit_clarification", "present_mirror", "abandon"],
  consent: ["select_disposition", "clarify", "abandon"],
  commit: ["commit_succeeded", "commit_failed"],
  revisit: ["open_conflict", "affirm", "defer"],
  reconcile: ["resolve_conflict", "defer"],
  complete: [],
  abandoned: [],
};

// ── Errors ──────────────────────────────────────────────────────────

export class InvalidSessionTransitionError extends Error {
  constructor(
    public readonly detail: {
      sessionId: string;
      currentPhase: HonestConversationPhase;
      attemptedAction: SessionAction;
    }
  ) {
    super(
      `Illegal transition: action "${detail.attemptedAction}" not permitted in phase "${detail.currentPhase}" (session ${detail.sessionId})`
    );
    this.name = "InvalidSessionTransitionError";
  }
}

export class StaleSessionVersionError extends Error {
  constructor(
    public readonly detail: { sessionId: string; expected: number; actual: number }
  ) {
    super(
      `Stale session version: expected ${detail.expected}, actual ${detail.actual} (session ${detail.sessionId})`
    );
    this.name = "StaleSessionVersionError";
  }
}

function assertAllowed(
  session: HonestConversationSession,
  action: SessionAction
): void {
  if (!ALLOWED_ACTIONS[session.phase].includes(action)) {
    throw new InvalidSessionTransitionError({
      sessionId: session.sessionId,
      currentPhase: session.phase,
      attemptedAction: action,
    });
  }
}

// ── Pending-action derivation ────────────────────────────────────────

export function derivePendingAction(
  session: HonestConversationSession
): PendingAction | undefined {
  switch (session.phase) {
    case "observe":
      return { type: "provide_observation" };
    case "mirror":
      return { type: "present_mirror" };
    case "propose":
      return session.activeProposalId
        ? { type: "confirm_mirror", proposalId: session.activeProposalId }
        : undefined;
    case "clarify":
      return session.activeProposalId
        ? { type: "provide_clarification", proposalId: session.activeProposalId }
        : undefined;
    case "consent":
      return session.activeProposalId
        ? { type: "choose_disposition", proposalId: session.activeProposalId }
        : undefined;
    case "commit":
      return session.activeProposalId && session.disposition
        ? {
            type: "confirm_commit",
            proposalId: session.activeProposalId,
            disposition: session.disposition,
          }
        : undefined;
    case "reconcile":
      return session.relatedConflictId
        ? { type: "resolve_conflict", conflictId: session.relatedConflictId }
        : undefined;
    default:
      return undefined;
  }
}

// ── Reducer ──────────────────────────────────────────────────────────

export function reduceSession(
  sessionId: string,
  events: ConversationEvent[]
): HonestConversationSession {
  const sorted = [...events].sort((a, b) => a.streamVersion - b.streamVersion);
  let session: HonestConversationSession | null = null;
  for (const event of sorted) {
    session = applyConversationEvent(session, event, sessionId);
  }
  if (!session) throw new Error("No session.started event found");
  session.pendingAction = derivePendingAction(session);
  return session;
}

function applyConversationEvent(
  prev: HonestConversationSession | null,
  event: ConversationEvent,
  sessionId: string
): HonestConversationSession {
  const p = event.payload || {};
  const base: HonestConversationSession = prev
    ? { ...prev }
    : {
        sessionId,
        userId: p.userId ?? "",
        phase: "observe",
        version: 0,
        observationIds: [],
        supersededProposalIds: [],
        startedAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };

  base.version = event.streamVersion;
  base.updatedAt = event.occurredAt;

  switch (event.type) {
    case "session.started":
      base.userId = p.userId ?? base.userId;
      base.phase = p.phase ?? "observe";
      if (p.relatedConceptId) base.relatedConceptId = p.relatedConceptId;
      if (p.revisitTrigger) base.revisitTrigger = p.revisitTrigger;
      break;

    case "observation.submitted":
      base.observationIds = [...base.observationIds, p.observationId];
      base.phase = "mirror";
      break;

    case "mirror.presented":
      base.activeProposalId = p.proposalId;
      base.phase = "propose";
      break;

    case "proposal.superseded":
      if (base.activeProposalId && !base.supersededProposalIds.includes(base.activeProposalId)) {
        base.supersededProposalIds = [...base.supersededProposalIds, base.activeProposalId];
      }
      break;

    case "clarification.requested":
      base.phase = "clarify";
      break;

    case "clarification.provided":
      base.phase = "mirror";
      break;

    case "proposal.confirmed":
      base.phase = "consent";
      break;

    case "consent.requested":
      // informational; phase already consent from proposal.confirmed
      break;

    case "proposal.rejected":
      base.phase = "complete";
      base.completedAt = event.occurredAt;
      break;

    case "memory.disposition_selected":
      base.disposition = p.disposition;
      base.phase = "commit";
      break;

    case "memory.marked_transient":
    case "memory.declined":
      base.phase = "complete";
      base.completedAt = event.occurredAt;
      break;

    case "memory.committed":
      base.phase = "complete";
      base.relatedConceptId = p.conceptId ?? base.relatedConceptId;
      base.completedAt = event.occurredAt;
      break;

    case "memory.commit_failed":
      base.phase = "consent";
      break;

    case "review.invited":
      base.phase = "revisit";
      break;

    case "conflict.opened":
      base.relatedConflictId = p.conflictId;
      base.phase = "reconcile";
      break;

    case "conflict.resolved":
      base.phase = "complete";
      base.completedAt = event.occurredAt;
      break;

    case "revisit.affirmed":
      base.phase = "complete";
      base.completedAt = event.occurredAt;
      break;

    case "revisit.deferred":
      base.phase = "complete";
      base.completedAt = event.occurredAt;
      break;

    case "session.completed":
      base.phase = "complete";
      base.completedAt = event.occurredAt;
      break;

    case "session.abandoned":
      base.phase = "abandoned";
      break;

    default:
      break;
  }

  return base;
}

// ── Pure command applicators ─────────────────────────────────────────
// Each validates its transition and returns conversation events to append,
// plus an optional ledger command. They are pure: no store mutation.

export function applySubmitObservation(
  session: HonestConversationSession,
  input: { observationId: string; text: string }
): CommandResult {
  assertAllowed(session, "submit_observation");
  return {
    conversationEvents: [
      {
        type: "observation.submitted",
        payload: { observationId: input.observationId, text: input.text },
      },
    ],
  };
}

export function applyPresentMirror(
  session: HonestConversationSession,
  input: { proposal: MirrorProposal }
): CommandResult {
  assertAllowed(session, "present_mirror");
  const events: ConversationEventInput[] = [];
  const revises = session.activeProposalId;
  if (revises && (session.phase === "clarify" || session.phase === "mirror")) {
    if (session.phase === "clarify" || input.proposal.revision > 1) {
      events.push({
        type: "proposal.superseded",
        payload: { proposalId: revises, supersededBy: input.proposal.proposalId },
      });
    }
  }
  events.push({
    type: "mirror.presented",
    payload: { proposalId: input.proposal.proposalId, revision: input.proposal.revision },
  });
  return { conversationEvents: events };
}

export function applyRespondToProposal(
  session: HonestConversationSession,
  input: {
    response:
      | { type: "confirm" }
      | { type: "clarify"; text?: string }
      | { type: "reject" };
  }
): CommandResult {
  const events: ConversationEventInput[] = [];
  if (input.response.type === "confirm") {
    assertAllowed(session, "confirm");
    events.push({ type: "proposal.confirmed", payload: { proposalId: session.activeProposalId } });
  } else if (input.response.type === "clarify") {
    assertAllowed(session, "clarify");
    if (input.response.text) {
      events.push({
        type: "clarification.provided",
        payload: { proposalId: session.activeProposalId, text: input.response.text },
      });
    } else {
      events.push({ type: "clarification.requested", payload: { proposalId: session.activeProposalId } });
    }
  } else {
    assertAllowed(session, "reject");
    events.push({ type: "proposal.rejected", payload: { proposalId: session.activeProposalId } });
  }
  return { conversationEvents: events };
}

export function applySubmitClarification(
  session: HonestConversationSession,
  input: { text: string }
): CommandResult {
  assertAllowed(session, "submit_clarification");
  return {
    conversationEvents: [
      {
        type: "clarification.provided",
        payload: { proposalId: session.activeProposalId, text: input.text },
      },
    ],
  };
}

export function applySelectDisposition(
  session: HonestConversationSession,
  input: { disposition: MemoryDisposition }
): CommandResult {
  assertAllowed(session, "select_disposition");
  const now = new Date().toISOString();
  if (input.disposition === "transient") {
    return {
      conversationEvents: [
        { type: "memory.marked_transient", payload: { proposalId: session.activeProposalId } },
      ],
    };
  }
  if (input.disposition === "do_not_remember") {
    return {
      conversationEvents: [
        { type: "memory.declined", payload: { proposalId: session.activeProposalId } },
      ],
    };
  }
  // emerging / ongoing → commit phase
  return {
    conversationEvents: [
      {
        type: "memory.disposition_selected",
        payload: { proposalId: session.activeProposalId, disposition: input.disposition },
      },
    ],
  };
}

export function applyCommitMemory(
  session: HonestConversationSession,
  input: { proposal: MirrorProposal; idempotencyKey: string; conceptId: string }
): { ledgerCommand: LedgerCommand; successEvents: ConversationEventInput[] } {
  assertAllowed(session, "commit_succeeded");
  const occurredAt = new Date().toISOString();
  return {
    ledgerCommand: {
      kind: "commit_concept",
      proposal: input.proposal,
      disposition: session.disposition ?? "emerging",
      sessionId: session.sessionId,
      dispositionEventId: `disposition-${session.sessionId}`,
      occurredAt,
    },
    successEvents: [
      {
        type: "memory.committed",
        payload: {
          conceptId: input.conceptId,
          proposalId: input.proposal.proposalId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    ],
  };
}

export function applyCommitFailure(session: HonestConversationSession): CommandResult {
  assertAllowed(session, "commit_failed");
  return {
    conversationEvents: [
      { type: "memory.commit_failed", payload: { proposalId: session.activeProposalId } },
    ],
  };
}

export function applyOpenConflict(
  session: HonestConversationSession,
  input: { conflict: ConflictCandidate }
): CommandResult {
  assertAllowed(session, "open_conflict");
  return {
    conversationEvents: [
      { type: "conflict.opened", payload: input.conflict },
    ],
    ledgerCommand: {
      kind: "open_conflict",
      conflict: input.conflict,
      conceptId: input.conflict.conceptId,
      sessionId: session.sessionId,
      occurredAt: new Date().toISOString(),
    },
  };
}

export function applyResolveConflict(
  session: HonestConversationSession,
  input: {
    resolution: ReconciliationResolution;
    explanation?: string;
    contexts?: ContextEntry[];
    newProposition?: string;
    conceptId: string;
  }
): CommandResult {
  assertAllowed(session, "resolve_conflict");
  const occurredAt = new Date().toISOString();
  const ledgerCommand: LedgerCommand = {
    kind: "reconcile",
    conceptId: input.conceptId,
    conflictId: session.relatedConflictId ?? "",
    resolution: input.resolution,
    explanation: input.explanation,
    contexts: input.contexts,
    newProposition: input.newProposition,
    sessionId: session.sessionId,
    occurredAt,
  };
  return {
    conversationEvents: [
      {
        type: "conflict.resolved",
        payload: { resolution: input.resolution, conflictId: session.relatedConflictId },
      },
    ],
    ledgerCommand,
  };
}

export function applyRevisitAffirm(
  session: HonestConversationSession,
  input: { conceptId: string }
): CommandResult {
  assertAllowed(session, "affirm");
  const occurredAt = new Date().toISOString();
  return {
    conversationEvents: [
      { type: "revisit.affirmed", payload: { conceptId: input.conceptId } },
    ],
    ledgerCommand: {
      kind: "reaffirm",
      conceptId: input.conceptId,
      conflictId: session.relatedConflictId,
      sessionId: session.sessionId,
      occurredAt,
    },
  };
}

export function applyRevisitDefer(session: HonestConversationSession): CommandResult {
  assertAllowed(session, "defer");
  return {
    conversationEvents: [
      { type: "revisit.deferred", payload: {} },
    ],
  };
}

export function applyAbandon(session: HonestConversationSession): CommandResult {
  return {
    conversationEvents: [{ type: "session.abandoned", payload: {} }],
  };
}