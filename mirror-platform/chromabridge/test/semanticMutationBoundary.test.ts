import { describe, it, expect } from "vitest";
import {
  createSemanticMutationService,
  createEnforcedSemanticEventStore,
  type SemanticEventStore,
  type SemanticEvent,
  type AuthorizedSemanticCommit,
  UnauthorizedSemanticCommitError,
  StaleStreamVersionError,
  InvalidSemanticMutationTypeError,
  IntegrityOperationMismatchError,
  UnauthorizedSemanticAppendError,
  AuthorityAlreadyConsumedError,
} from "../base44/shared/semanticMutationBoundary";

// ── In-memory semantic event store (the protected ledger) ──────────────────

function inMemoryStore(): SemanticEventStore & { events: SemanticEvent[] } {
  const events: SemanticEvent[] = [];
  return {
    events,
    async append(event: SemanticEvent): Promise<SemanticEvent> {
      events.push(event);
      return event;
    },
    async getStreamVersion(conceptId: string): Promise<number> {
      return events.filter((e) => e.conceptId === conceptId).length;
    },
    async findByIdempotencyKey(key: string): Promise<SemanticEvent | null> {
      return events.find((e) => e.authorization.idempotencyKey === key) ?? null;
    },
    async findByAuthorization(sessionId: string, userDecisionEventId: string): Promise<SemanticEvent | null> {
      return (
        events.find(
          (e) => e.authorization.sessionId === sessionId && e.authorization.userDecisionEventId === userDecisionEventId
        ) ?? null
      );
    },
  };
}

function validCommit(overrides: Partial<AuthorizedSemanticCommit> = {}): AuthorizedSemanticCommit {
  return {
    mutation: {
      type: "promote",
      conceptId: "concept-1",
      payload: { proposition: "The user is becoming more deliberate." },
    },
    conversationSessionId: "session-1",
    userDecisionEventId: "decision-1",
    authorizerId: "user-1",
    evidenceIds: ["ev-1", "ev-2"],
    expectedStreamVersion: 0,
    idempotencyKey: "key-1",
    ...overrides,
  };
}

function rawEvent(overrides: Partial<SemanticEvent> = {}): SemanticEvent {
  return {
    id: "evt-x",
    conceptId: "concept-1",
    mutationType: "promote",
    eventType: "promoted",
    payload: {},
    streamVersion: 1,
    authorization: {
      authorizationId: "auth-1",
      source: "honest_conversation",
      sessionId: "session-1",
      userDecisionEventId: "decision-1",
      idempotencyKey: "key-1",
    },
    authorizerId: "user-1",
    evidenceIds: ["ev-1"],
    appliedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Boundary contract: rejections of every known shortcut ───────────────────

describe("Semantic Mutation Boundary", () => {
  it("rejects direct promotion without a conversation session (Epistemic Lab button bypass)", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await expect(svc.commit(validCommit({ conversationSessionId: "" }))).rejects.toThrow(
      UnauthorizedSemanticCommitError
    );
    expect(store.events).toHaveLength(0);
  });

  it("rejects split without an authorized commit", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await expect(
      svc.commit(
        validCommit({
          mutation: { type: "split", conceptId: "concept-1", payload: {} },
          conversationSessionId: "",
          userDecisionEventId: "",
        })
      )
    ).rejects.toThrow(UnauthorizedSemanticCommitError);
    expect(store.events).toHaveLength(0);
  });

  it("rejects merge without an authorized commit", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await expect(
      svc.commit(
        validCommit({
          mutation: { type: "merge", conceptId: "concept-1", targetId: "concept-2", payload: {} },
          idempotencyKey: "",
        })
      )
    ).rejects.toThrow(UnauthorizedSemanticCommitError);
    expect(store.events).toHaveLength(0);
  });

  it("rejects supersede without an authorized commit", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await expect(
      svc.commit(
        validCommit({
          mutation: { type: "supersede", conceptId: "concept-1", targetId: "concept-2", payload: {} },
          userDecisionEventId: "",
        })
      )
    ).rejects.toThrow(UnauthorizedSemanticCommitError);
    expect(store.events).toHaveLength(0);
  });

  it("rejects a confidence mutation without provenance and authorization", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await expect(
      svc.commit(
        validCommit({
          mutation: { type: "confidence_adjust", conceptId: "concept-1", payload: { delta: 0.2 } },
          conversationSessionId: "",
          userDecisionEventId: "",
          idempotencyKey: "",
          evidenceIds: [],
        })
      )
    ).rejects.toThrow(UnauthorizedSemanticCommitError);
    expect(store.events).toHaveLength(0);
  });

  it("rejects persona fixed-star writes (relabel) without a user disposition", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await expect(
      svc.commit(
        validCommit({
          mutation: { type: "relabel", conceptId: "concept-star", payload: { labels: ["grounded"] } },
          userDecisionEventId: "",
        })
      )
    ).rejects.toThrow(UnauthorizedSemanticCommitError);
    expect(store.events).toHaveLength(0);
  });

  it("rejects a Librarian semantic write routed through the integrity path", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await expect(
      svc.runIntegrity({ operation: "merge" as any, provesNoMeaningChange: true, conceptId: "concept-1" })
    ).rejects.toThrow(IntegrityOperationMismatchError);
    expect(store.events).toHaveLength(0);
  });

  it("rejects an integrity command on the semantic commit path", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await expect(
      svc.commit(
        validCommit({ mutation: { type: "rebuild_projection" as any, conceptId: "concept-1", payload: {} } })
      )
    ).rejects.toThrow(InvalidSemanticMutationTypeError);
    expect(store.events).toHaveLength(0);
  });

  it("rejects a stale stream version", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await svc.commit(validCommit({ idempotencyKey: "k-a" }));
    await expect(svc.commit(validCommit({ idempotencyKey: "k-b", expectedStreamVersion: 0 }))).rejects.toThrow(
      StaleStreamVersionError
    );
    expect(store.events).toHaveLength(1);
  });

  it("allows an agent to create a semantic proposal without mutating the ledger", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const proposal = await svc.propose({
      mutation: { type: "merge", conceptId: "concept-1", targetId: "concept-2", payload: {} },
      proposedBy: "LibrarianAgent",
      rationale: "Two nodes describe the same shade of patience.",
      evidenceIds: ["ev-1", "ev-2"],
    });
    expect(proposal.status).toBe("pending");
    expect(proposal.proposedBy).toBe("LibrarianAgent");
    expect(store.events).toHaveLength(0);
  });

  it("allows semantic commitment after explicit user disposition", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const result = await svc.commit(validCommit());
    expect(result.status).toBe("committed");
    expect(store.events).toHaveLength(1);
    expect(store.events[0].authorization.sessionId).toBe("session-1");
    expect(store.events[0].authorization.userDecisionEventId).toBe("decision-1");
    expect(store.events[0].mutationType).toBe("promote");
    expect(store.events[0].streamVersion).toBe(1);
  });

  it("allows retry with the same idempotency key without duplicate mutation", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const first = await svc.commit(validCommit({ idempotencyKey: "retry-key" }));
    expect(first.status).toBe("committed");
    const replay = await svc.commit(validCommit({ idempotencyKey: "retry-key" }));
    expect(replay.status).toBe("idempotent_replay");
    expect(store.events).toHaveLength(1);
  });

  it("allows integrity-only projection rebuild without appending a semantic event", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const result = await svc.runIntegrity({
      operation: "rebuild_projection",
      provesNoMeaningChange: true,
      conceptId: "concept-1",
    });
    expect(result.semanticEventsAppended).toBe(0);
    expect(store.events).toHaveLength(0);
  });

  it("never appends a semantic event outside the commit boundary", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await svc.propose({
      mutation: { type: "reparent", conceptId: "concept-1", payload: {} },
      proposedBy: "LibrarianAgent",
      rationale: "Orphan may belong to Hope.",
    });
    await svc.runIntegrity({ operation: "repair_index", provesNoMeaningChange: true, conceptId: "concept-1" });
    await svc.runIntegrity({
      operation: "recompute_derived_position",
      provesNoMeaningChange: true,
      conceptId: "concept-1",
    });
    expect(store.events).toHaveLength(0);
    await svc.commit(validCommit());
    expect(store.events).toHaveLength(1);
  });
});

// ── Event-store enforcement: the second line of defense ────────────────────

describe("Semantic event-store enforcement", () => {
  it("rejects a direct append without authorization metadata", async () => {
    const store = inMemoryStore();
    const enforced = createEnforcedSemanticEventStore(store);
    const fake = rawEvent();
    delete (fake as any).authorization;
    await expect(enforced.append(fake)).rejects.toThrow(UnauthorizedSemanticAppendError);
    expect(store.events).toHaveLength(0);
  });

  it("rejects an append whose source is not an honest conversation", async () => {
    const enforced = createEnforcedSemanticEventStore(inMemoryStore());
    await expect(
      enforced.append(
        rawEvent({ authorization: { ...rawEvent().authorization, source: "agent_autonomous" as any } })
      )
    ).rejects.toThrow(UnauthorizedSemanticAppendError);
  });

  it("rejects an append missing individual authorization fields", async () => {
    const enforced = createEnforcedSemanticEventStore(inMemoryStore());
    await expect(
      enforced.append(rawEvent({ authorization: { ...rawEvent().authorization, sessionId: "" } }))
    ).rejects.toThrow(UnauthorizedSemanticAppendError);
    await expect(
      enforced.append(rawEvent({ authorization: { ...rawEvent().authorization, userDecisionEventId: "" } }))
    ).rejects.toThrow(UnauthorizedSemanticAppendError);
    await expect(
      enforced.append(rawEvent({ authorization: { ...rawEvent().authorization, idempotencyKey: "" } }))
    ).rejects.toThrow(UnauthorizedSemanticAppendError);
  });

  it("accepts a properly authorized append", async () => {
    const store = inMemoryStore();
    const enforced = createEnforcedSemanticEventStore(store);
    await enforced.append(rawEvent());
    expect(store.events).toHaveLength(1);
  });

  it("lets the service's own commits pass enforcement (round-trip)", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const res = await svc.commit(validCommit());
    expect(res.status).toBe("committed");
    expect(store.events[0].authorization.source).toBe("honest_conversation");
    expect(store.events[0].authorization.authorizationId).toBeTruthy();
  });
});

// ── Provenance: every committed event answers the forensic questions ──────

describe("Semantic commit provenance", () => {
  it("records who authorized, what evidence, and which session produced the decision", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const res = await svc.commit(validCommit({ authorizerId: "user-7", evidenceIds: ["ev-1", "ev-2", "ev-3"] }));
    if (res.status !== "committed") throw new Error("expected committed");
    const ev = res.event;
    expect(ev.authorizerId).toBe("user-7");
    expect(ev.evidenceIds).toEqual(["ev-1", "ev-2", "ev-3"]);
    expect(ev.authorization.sessionId).toBe("session-1");
    expect(ev.authorization.userDecisionEventId).toBe("decision-1");
    expect(ev.authorization.authorizationId).toBeTruthy();
    expect(ev.mutationType).toBe("promote");
    expect(ev.payload.proposition).toBe("The user is becoming more deliberate.");
  });

  it("records the prior event a supersede replaces", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const res = await svc.commit(
      validCommit({
        mutation: { type: "supersede", conceptId: "concept-1", targetId: "concept-2", payload: {} },
        replacesEventId: "evt-prior",
      })
    );
    if (res.status !== "committed") throw new Error("expected committed");
    expect(res.event.replacesEventId).toBe("evt-prior");
  });

  it("leaves replacesEventId unset for a fresh promotion", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const res = await svc.commit(validCommit());
    if (res.status !== "committed") throw new Error("expected committed");
    expect(res.event.replacesEventId).toBeUndefined();
  });
});

// ── Single-use authority: consent cannot be replayed ───────────────────────

describe("Single-use authority", () => {
  it("rejects a second, different commit reusing the same session and decision", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const first = await svc.commit(validCommit({ idempotencyKey: "k-1" }));
    expect(first.status).toBe("committed");
    await expect(
      svc.commit(
        validCommit({
          idempotencyKey: "k-2",
          mutation: { type: "confidence_adjust", conceptId: "concept-1", payload: { delta: 0.2 } },
        })
      )
    ).rejects.toThrow(AuthorityAlreadyConsumedError);
    expect(store.events).toHaveLength(1);
  });

  it("still allows an exact idempotent replay of the same authorized commit", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    const first = await svc.commit(validCommit({ idempotencyKey: "replay-key" }));
    expect(first.status).toBe("committed");
    const replay = await svc.commit(validCommit({ idempotencyKey: "replay-key" }));
    expect(replay.status).toBe("idempotent_replay");
    expect(store.events).toHaveLength(1);
  });

  it("allows a different session/decision to authorize a different mutation", async () => {
    const store = inMemoryStore();
    const svc = createSemanticMutationService(store);
    await svc.commit(validCommit({ idempotencyKey: "k-1" }));
    const second = await svc.commit(
      validCommit({
        idempotencyKey: "k-2",
        conversationSessionId: "session-2",
        userDecisionEventId: "decision-2",
        expectedStreamVersion: 1,
        mutation: { type: "confidence_adjust", conceptId: "concept-1", payload: { delta: 0.1 } },
      })
    );
    expect(second.status).toBe("committed");
    expect(store.events).toHaveLength(2);
  });

  it("the event store independently rejects a bypass that reuses consumed authority", async () => {
    const store = inMemoryStore();
    const enforced = createEnforcedSemanticEventStore(store);
    await enforced.append(
      rawEvent({ id: "evt-1", authorization: { ...rawEvent().authorization, idempotencyKey: "k-1" } })
    );
    await expect(
      enforced.append(rawEvent({ id: "evt-2", authorization: { ...rawEvent().authorization, idempotencyKey: "k-2" } }))
    ).rejects.toThrow(UnauthorizedSemanticAppendError);
    expect(store.events).toHaveLength(1);
  });
});