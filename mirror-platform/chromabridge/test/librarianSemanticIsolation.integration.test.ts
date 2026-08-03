/**
 * Librarian semantic isolation — proves the Librarian (and any scheduled
 * agent) may run integrity maintenance and surface proposals, but may NEVER
 * autonomously commit durable meaning.
 */
import { describe, it, expect } from "vitest";
import { createConstitutionalHarness } from "./lib/constitutionalHarness";

describe("Librarian semantic isolation", () => {
  it("allows scheduled integrity maintenance", async () => {
    const { mutationService, eventStore } = createConstitutionalHarness();

    const rebuild = await mutationService.runIntegrity({
      operation: "rebuild_projection", provesNoMeaningChange: true, conceptId: "c1",
    });
    const repair = await mutationService.runIntegrity({
      operation: "repair_index", provesNoMeaningChange: true, conceptId: "c1",
    });
    const detect = await mutationService.runIntegrity({
      operation: "detect_anomaly", provesNoMeaningChange: true, conceptId: "c1",
    });

    expect(rebuild.semanticEventsAppended).toBe(0);
    expect(repair.semanticEventsAppended).toBe(0);
    expect(detect.semanticEventsAppended).toBe(0);
    expect(eventStore.semanticEvents()).toHaveLength(0);
    expect(eventStore.persistentConcepts()).toHaveLength(0);
  });

  it("converts semantic findings into proposals, never commitments", async () => {
    const { mutationService, eventStore } = createConstitutionalHarness();

    const mergeProposal = await mutationService.propose({
      mutation: { type: "merge", conceptId: "c1", targetId: "c2", payload: {} },
      proposedBy: "LibrarianAgent", rationale: "Two nodes describe the same shade of patience.",
      evidenceIds: ["e1", "e2"],
    });
    const relabelProposal = await mutationService.propose({
      mutation: { type: "relabel", conceptId: "c1", payload: { labels: ["grounded"] } },
      proposedBy: "LibrarianAgent", rationale: "A clearer label for this cluster.",
    });
    const reparentProposal = await mutationService.propose({
      mutation: { type: "reparent", conceptId: "c1", payload: {} },
      proposedBy: "LibrarianAgent", rationale: "Orphan may belong to Hope.",
    });

    expect(mergeProposal.status).toBe("pending");
    expect(relabelProposal.status).toBe("pending");
    expect(reparentProposal.status).toBe("pending");
    expect(eventStore.semanticEvents()).toHaveLength(0);
    expect(eventStore.persistentConcepts()).toHaveLength(0);
  });

  it("rejects autonomous semantic commitment", async () => {
    const { mutationService, eventStore } = createConstitutionalHarness();

    // The Librarian has no conversation session and no user decision, so the
    // required authorization fields are absent.
    await expect(
      mutationService.commit({
        mutation: { type: "merge", conceptId: "c1", targetId: "c2", payload: {} },
        conversationSessionId: "",
        userDecisionEventId: "",
        authorizerId: "LibrarianAgent",
        evidenceIds: [],
        expectedStreamVersion: 0,
        idempotencyKey: "lib-merge-1",
      })
    ).rejects.toThrow();
    expect(eventStore.semanticEvents()).toHaveLength(0);

    // A direct store append with a non-honest-conversation source is rejected.
    await expect(
      eventStore.appendSemanticEvent({
        id: "x", conceptId: "c1", mutationType: "merge", eventType: "merged", payload: {},
        streamVersion: 1,
        authorization: { authorizationId: "a", source: "agent_autonomous", sessionId: "", userDecisionEventId: "", idempotencyKey: "x" },
        authorizerId: "LibrarianAgent", evidenceIds: [], appliedAt: new Date().toISOString(),
      })
    ).rejects.toThrow();
    expect(eventStore.semanticEvents()).toHaveLength(0);
    expect(eventStore.persistentConcepts()).toHaveLength(0);
  });
});