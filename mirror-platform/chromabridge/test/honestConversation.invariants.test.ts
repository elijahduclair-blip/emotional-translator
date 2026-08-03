import { describe, it, expect } from "vitest";
import { setup } from "./lib/harness";

describe("no provisional ghosts", () => {
  it("does not create semantic state before commitment", async () => {
    const { runConversation, freshProposal, conceptEventStore, generateSemanticSnapshot } = setup();
    const proposalV1 = freshProposal({ inference: "You value independence." });
    const proposalV2 = freshProposal({ revision: 2, inference: "You value independence at work." });

    const session = await runConversation([
      { cmd: "submitObservation", text: "I think I am becoming more independent." },
      { cmd: "presentMirror", proposal: proposalV1 },
      { cmd: "respond", response: { type: "clarify", text: "I mean mostly at work." } },
      { cmd: "presentMirror", proposal: proposalV2 },
      { cmd: "respond", response: { type: "confirm" } },
      { cmd: "selectDisposition", disposition: "ongoing" },
    ]);

    expect(session.phase).toBe("commit");
    expect(conceptEventStore).toEqual([]);
    expect(generateSemanticSnapshot("any")).toEqual(
      expect.objectContaining({
        current: expect.objectContaining({ userConfirmed: false, supportingEvidence: [] }),
        unresolvedConflicts: [],
      })
    );
  });
});

describe("consent invariants", () => {
  it("does not infer consent from confirming the mirror", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    expect(s.phase).toBe("consent");
  });

  it("requires a recognized disposition before commit", async () => {
    const { service, freshProposal, conceptEventStore } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    await expect(
      service.commitMemory({ sessionId: s.sessionId, expectedVersion: s.version, idempotencyKey: "k" })
    ).rejects.toThrow("No explicit persistent disposition");
    expect(conceptEventStore).toEqual([]);
  });

  it("allows disposition changes before commit", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "emerging" });
    expect(s.disposition).toBe("emerging");
  });
});

describe("clarification history", () => {
  it("preserves superseded proposals within the session audit trail", async () => {
    const { runConversation, freshProposal, conversationEventStore } = setup();
    const proposalV1 = freshProposal({ inference: "You value independence." });
    const proposalV2 = freshProposal({ revision: 2, inference: "You value independence at work." });

    const result = await runConversation([
      { cmd: "submitObservation", text: "I value independence." },
      { cmd: "presentMirror", proposal: proposalV1 },
      { cmd: "respond", response: { type: "clarify", text: "Only in work decisions." } },
      { cmd: "presentMirror", proposal: proposalV2 },
    ]);

    expect(result.activeProposalId).toBe(proposalV2.proposalId);
    expect(result.supersededProposalIds).toContain(proposalV1.proposalId);

    expect(conversationEventStore).toContainEqual(
      expect.objectContaining({
        type: "proposal.superseded",
        payload: expect.objectContaining({
          proposalId: proposalV1.proposalId,
          supersededBy: proposalV2.proposalId,
        }),
      })
    );
  });
});

describe("memory disposition outcomes", () => {
  it("commits an emerging memory to the ledger", async () => {
    const { service, freshProposal, conceptEventStore } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal({ inference: "emerging memory" }) });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "emerging" });
    const res = await service.commitMemory({ sessionId: s.sessionId, expectedVersion: s.version, idempotencyKey: "k1" });
    expect(res.status).toBe("committed");
    expect(conceptEventStore.filter((e) => e.type === "concept.committed")).toHaveLength(1);
  });

  it("commits an ongoing memory to the ledger", async () => {
    const { service, freshProposal, conceptEventStore } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "ongoing" });
    const res = await service.commitMemory({ sessionId: s.sessionId, expectedVersion: s.version, idempotencyKey: "k2" });
    expect(res.status).toBe("committed");
    expect(conceptEventStore.filter((e) => e.type === "concept.committed")).toHaveLength(1);
  });

  it("completes without ledger mutation for transient", async () => {
    const { service, freshProposal, conceptEventStore } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "transient" });
    expect(s.phase).toBe("complete");
    expect(conceptEventStore).toEqual([]);
  });

  it("completes without ledger mutation for do_not_remember", async () => {
    const { service, freshProposal, conceptEventStore } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "do_not_remember" });
    expect(s.phase).toBe("complete");
    expect(conceptEventStore).toEqual([]);
  });

  it("does not treat rejection as negative evidence", async () => {
    const { service, freshProposal, conceptEventStore } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "reject" } });
    expect(s.phase).toBe("complete");
    expect(conceptEventStore).toEqual([]);
  });
});

describe("revisit creates a new session", () => {
  it("creates a new linked session when a concept is revisited", async () => {
    const { service, completedSessionFor } = setup();
    const original = await completedSessionFor("concept-1");
    const revisit = await service.startRevisitSession({ conceptId: original.relatedConceptId!, trigger: "contradictory_evidence" });
    expect(revisit.sessionId).not.toBe(original.sessionId);
    expect(revisit.phase).toBe("revisit");
    expect(revisit.relatedConceptId).toBe(original.relatedConceptId);
    expect(original.phase).toBe("complete");
  });
});