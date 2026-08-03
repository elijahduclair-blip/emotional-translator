/**
 * Semantic Mutation Boundary
 *
 * The single constitutional gate between temporary understanding and durable
 * semantic memory. No UI, agent, scheduled process, or graph utility may
 * append a semantic event except through `commit()` here.
 *
 * Three operation classes, deliberately incompatible so one handler cannot
 * accept another's command:
 *
 *   Integrity mutation  (runIntegrity)  — may run autonomously; touches only
 *                                         operational/derived fields.
 *   Semantic proposal   (propose)       — advisory; never mutates the ledger.
 *   Semantic commitment (commit)       — the only path to durable meaning.
 *
 * The protected resource is not data — it is meaning. Authorization to alter
 * a person's remembered meaning is earned only through an explicit user
 * disposition recorded in a committed conversation session.
 */

// ── Semantic mutations (the only things that may change durable meaning) ──

export type SemanticMutationType =
  | "promote"
  | "merge"
  | "split"
  | "supersede"
  | "relabel"
  | "reparent"
  | "connect"
  | "confidence_adjust"
  | "resolve_contradiction"
  | "assign_position"
  | "archive";

export const SEMANTIC_MUTATION_TYPES: ReadonlySet<SemanticMutationType> = new Set([
  "promote",
  "merge",
  "split",
  "supersede",
  "relabel",
  "reparent",
  "connect",
  "confidence_adjust",
  "resolve_contradiction",
  "assign_position",
  "archive",
]);

export interface SemanticMutation {
  type: SemanticMutationType;
  conceptId: string;
  targetId?: string;
  payload: Record<string, any>;
}

// ── Authorization evidence (required for every commit) ─────────────────────

/**
 * Proof that a user, in a committed conversation session, explicitly chose to
 * persist a meaning. Without all four fields, a commit is unauthorized.
 */
export interface AuthorizedSemanticCommit {
  mutation: SemanticMutation;
  conversationSessionId: string;
  userDecisionEventId: string;
  authorizerId: string; // who made the decision (the user)
  evidenceIds: string[]; // what evidence supported it
  expectedStreamVersion: number;
  idempotencyKey: string;
  replacesEventId?: string; // prior event this extends/replaces (supersede/merge)
}

// ── Integrity operations (autonomous; must not change meaning) ────────────

export type IntegrityOperationType =
  | "rebuild_projection"
  | "repair_index"
  | "remove_duplicate_storage"
  | "restore_reference"
  | "recompute_derived_position"
  | "detect_anomaly";

export const INTEGRITY_OPERATION_TYPES: ReadonlySet<IntegrityOperationType> = new Set([
  "rebuild_projection",
  "repair_index",
  "remove_duplicate_storage",
  "restore_reference",
  "recompute_derived_position",
  "detect_anomaly",
]);

/**
 * The `provesNoMeaningChange: true` literal is a type-level marker: a semantic
 * commit command structurally cannot satisfy this interface, so the same
 * handler cannot accept both.
 */
export interface IntegrityMaintenanceCommand {
  operation: IntegrityOperationType;
  provesNoMeaningChange: true;
  conceptId?: string;
  payload?: Record<string, any>;
}

// ── Semantic proposals (advisory; never mutate the ledger) ─────────────────

export interface SemanticProposalCommand {
  mutation: SemanticMutation;
  proposedBy: string; // agent name, function name, or "system"
  rationale: string;
  evidenceIds?: string[];
}

export interface SemanticProposal {
  proposalId: string;
  mutation: SemanticMutation;
  proposedBy: string;
  rationale: string;
  evidenceIds: string[];
  createdAt: string;
  status: "pending" | "accepted" | "rejected" | "superseded";
}

// ── The semantic event store (the protected ledger) ───────────────────────

/**
 * Boundary-issued authorization metadata. The event store rejects any semantic
 * append that does not carry this — the second line of defense, so that even a
 * caller which bypasses the service boundary cannot persist meaning.
 */
export interface SemanticAuthorization {
  authorizationId: string;
  source: "honest_conversation";
  sessionId: string;
  userDecisionEventId: string;
  idempotencyKey: string;
}

export interface SemanticEvent {
  id: string;
  conceptId: string;
  mutationType: SemanticMutationType;
  eventType: string;
  payload: Record<string, any>;
  streamVersion: number;
  authorization: SemanticAuthorization;
  authorizerId: string;
  evidenceIds: string[];
  replacesEventId?: string;
  appliedAt: string;
}

export interface SemanticEventStore {
  append(event: SemanticEvent): Promise<SemanticEvent>;
  getStreamVersion(conceptId: string): Promise<number>;
  findByIdempotencyKey(key: string): Promise<SemanticEvent | null>;
  findByAuthorization(sessionId: string, userDecisionEventId: string): Promise<SemanticEvent | null>;
}

// ── Results ───────────────────────────────────────────────────────────────

export type CommitResult =
  | { status: "committed"; event: SemanticEvent }
  | { status: "idempotent_replay"; event: SemanticEvent };

export interface IntegrityResult {
  operation: IntegrityOperationType;
  conceptId?: string;
  completedAt: string;
  semanticEventsAppended: 0; // integrity never appends semantic events
}

// ── Errors ────────────────────────────────────────────────────────────────

export class UnauthorizedSemanticCommitError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Unauthorized semantic commit — missing authorization: ${missing.join(", ")}`);
    this.name = "UnauthorizedSemanticCommitError";
  }
}

export class StaleStreamVersionError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`Stale stream version: expected ${expected}, actual ${actual}`);
    this.name = "StaleStreamVersionError";
  }
}

export class InvalidSemanticMutationTypeError extends Error {
  constructor(public readonly attempted: string) {
    super(`Not a semantic mutation type: "${attempted}"`);
    this.name = "InvalidSemanticMutationTypeError";
  }
}

export class IntegrityOperationMismatchError extends Error {
  constructor(public readonly reason: string) {
    super(`Integrity/semantic command mismatch: ${reason}`);
    this.name = "IntegrityOperationMismatchError";
  }
}

export class UnauthorizedSemanticAppendError extends Error {
  constructor(public readonly reason: string) {
    super(`Unauthorized semantic append rejected by event store: ${reason}`);
    this.name = "UnauthorizedSemanticAppendError";
  }
}

export class AuthorityAlreadyConsumedError extends Error {
  constructor(
    public readonly detail: { sessionId: string; userDecisionEventId: string; consumedByEventId: string }
  ) {
    super(
      `Authority already consumed: session "${detail.sessionId}" decision "${detail.userDecisionEventId}" was used by mutation ${detail.consumedByEventId} — consent is single-use`
    );
    this.name = "AuthorityAlreadyConsumedError";
  }
}

// ── Mutation → concept event type mapping ─────────────────────────────────

const MUTATION_TO_EVENT_TYPE: Record<SemanticMutationType, string> = {
  promote: "promoted",
  merge: "merged",
  split: "split",
  supersede: "superseded",
  relabel: "clarify",
  reparent: "clarify",
  connect: "clarify",
  confidence_adjust: "confidence_adjusted",
  resolve_contradiction: "conflict_resolved",
  assign_position: "clarify",
  archive: "archived",
};

// ── The service ────────────────────────────────────────────────────────────

export interface SemanticMutationService {
  propose(command: SemanticProposalCommand): Promise<SemanticProposal>;
  commit(command: AuthorizedSemanticCommit): Promise<CommitResult>;
  runIntegrity(command: IntegrityMaintenanceCommand): Promise<IntegrityResult>;
}

/**
 * Wraps a semantic event store with authorization enforcement. Any append
 * missing valid `honest_conversation` authorization metadata is rejected.
 * This is the second line of defense: the service stamps authorization on its
 * own commits, and a bypass that reaches the store directly still fails.
 */
export function createEnforcedSemanticEventStore(inner: SemanticEventStore): SemanticEventStore {
  return {
    async append(event: SemanticEvent): Promise<SemanticEvent> {
      const auth = event.authorization;
      if (!auth) throw new UnauthorizedSemanticAppendError("missing authorization metadata");
      if (auth.source !== "honest_conversation")
        throw new UnauthorizedSemanticAppendError(`source must be "honest_conversation", got "${auth.source}"`);
      if (!auth.authorizationId) throw new UnauthorizedSemanticAppendError("missing authorizationId");
      if (!auth.sessionId) throw new UnauthorizedSemanticAppendError("missing sessionId");
      if (!auth.userDecisionEventId) throw new UnauthorizedSemanticAppendError("missing userDecisionEventId");
      if (!auth.idempotencyKey) throw new UnauthorizedSemanticAppendError("missing idempotencyKey");
      // Single-use authority: the same conversation decision may not authorize
      // a second, different mutation. An exact replay (same idempotency key) is
      // handled by the service; here we block a *different* commit reusing the
      // same authorization.
      const consumedBy = await inner.findByAuthorization(auth.sessionId, auth.userDecisionEventId);
      if (consumedBy && consumedBy.authorization.idempotencyKey !== auth.idempotencyKey) {
        throw new UnauthorizedSemanticAppendError(
          `authority already consumed by mutation ${consumedBy.id} — consent is single-use`
        );
      }
      return inner.append(event);
    },
    async getStreamVersion(conceptId: string): Promise<number> {
      return inner.getStreamVersion(conceptId);
    },
    async findByIdempotencyKey(key: string): Promise<SemanticEvent | null> {
      return inner.findByIdempotencyKey(key);
    },
    async findByAuthorization(sessionId: string, userDecisionEventId: string): Promise<SemanticEvent | null> {
      return inner.findByAuthorization(sessionId, userDecisionEventId);
    },
  };
}

export function createSemanticMutationService(
  store: SemanticEventStore,
  now: () => string = () => new Date().toISOString(),
  id: () => string = () => `evt-${Math.random().toString(36).slice(2)}`
): SemanticMutationService {
  const enforced = createEnforcedSemanticEventStore(store);
  const proposals = new Map<string, SemanticProposal>();

  return {
    async propose(command: SemanticProposalCommand): Promise<SemanticProposal> {
      if (!SEMANTIC_MUTATION_TYPES.has(command.mutation.type)) {
        throw new InvalidSemanticMutationTypeError(String(command.mutation.type));
      }
      const proposal: SemanticProposal = {
        proposalId: `prop-${id()}`,
        mutation: command.mutation,
        proposedBy: command.proposedBy,
        rationale: command.rationale,
        evidenceIds: command.evidenceIds ?? [],
        createdAt: now(),
        status: "pending",
      };
      proposals.set(proposal.proposalId, proposal);
      // A proposal NEVER appends to the semantic event store.
      return proposal;
    },

    async commit(command: AuthorizedSemanticCommit): Promise<CommitResult> {
      // 1. Mutation must be a recognized semantic type.
      if (!SEMANTIC_MUTATION_TYPES.has(command.mutation.type)) {
        throw new InvalidSemanticMutationTypeError(String(command.mutation.type));
      }

      // 2. Authorization + provenance evidence — all required fields present.
      const missing: string[] = [];
      if (!command.conversationSessionId) missing.push("conversationSessionId");
      if (!command.userDecisionEventId) missing.push("userDecisionEventId");
      if (!command.authorizerId) missing.push("authorizerId");
      if (!command.evidenceIds || command.evidenceIds.length === 0) missing.push("evidenceIds");
      if (!command.idempotencyKey) missing.push("idempotencyKey");
      if (missing.length > 0) throw new UnauthorizedSemanticCommitError(missing);

      // 3. Idempotency — a replayed commit returns the original event, never a duplicate.
      const existing = await store.findByIdempotencyKey(command.idempotencyKey);
      if (existing) return { status: "idempotent_replay", event: existing };

      // 3b. Single-use authority — a conversation session's decision may
      //     authorize exactly one mutation. Reusing the same authorization for
      //     a different commit is a consent-replay violation.
      const consumedBy = await store.findByAuthorization(
        command.conversationSessionId,
        command.userDecisionEventId
      );
      if (consumedBy && consumedBy.authorization.idempotencyKey !== command.idempotencyKey) {
        throw new AuthorityAlreadyConsumedError({
          sessionId: command.conversationSessionId,
          userDecisionEventId: command.userDecisionEventId,
          consumedByEventId: consumedBy.id,
        });
      }

      // 4. Optimistic concurrency — the stream must be at the expected version.
      const current = await store.getStreamVersion(command.mutation.conceptId);
      if (command.expectedStreamVersion !== current) {
        throw new StaleStreamVersionError(command.expectedStreamVersion, current);
      }

      // 5. Append the single authorized semantic event, stamped with boundary
      //    authorization + full provenance (what changed, what evidence,
      //    who authorized, which session, what prior state it replaces).
      const event: SemanticEvent = {
        id: id(),
        conceptId: command.mutation.conceptId,
        mutationType: command.mutation.type,
        eventType: MUTATION_TO_EVENT_TYPE[command.mutation.type],
        payload: command.mutation.payload ?? {},
        streamVersion: current + 1,
        authorization: {
          authorizationId: `auth-${id()}`,
          source: "honest_conversation",
          sessionId: command.conversationSessionId,
          userDecisionEventId: command.userDecisionEventId,
          idempotencyKey: command.idempotencyKey,
        },
        authorizerId: command.authorizerId,
        evidenceIds: command.evidenceIds,
        replacesEventId: command.replacesEventId,
        appliedAt: now(),
      };
      const appended = await enforced.append(event);
      return { status: "committed", event: appended };
    },

    async runIntegrity(command: IntegrityMaintenanceCommand): Promise<IntegrityResult> {
      // Integrity commands may not carry a semantic mutation. The type system
      // enforces this at compile time; this is the runtime guard.
      if (!INTEGRITY_OPERATION_TYPES.has(command.operation)) {
        throw new IntegrityOperationMismatchError(
          `"${command.operation}" is not an integrity operation — semantic mutations must use commit()`
        );
      }
      // Integrity operations NEVER append to the semantic event store.
      return {
        operation: command.operation,
        conceptId: command.conceptId,
        completedAt: now(),
        semanticEventsAppended: 0,
      };
    },
  };
}