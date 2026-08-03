import { describe, it, expect } from "vitest";
import { setup } from "./lib/harness";

async function arriveAtReconcile(h: ReturnType<typeof setup>, conceptId: string) {
  const revisit = await h.service.startRevisitSession({ conceptId, trigger: "contradictory_evidence" });
  const conflict = h.freshConflict({
    conceptId,
    earlierEvidenceIds: ["obs-earlier"],
    newerEvidenceIds: ["obs-newer"],
    explanation: "Earlier you valued independence; more recently you described seeking support.",
  });
  await h.service.openConflict({ sessionId: revisit.sessionId, expectedVersion: 1, conflict });
  return revisit;
}

describe("reconciliation outcomes", () => {
  it("reaffirms the existing concept without erasing conflict evidence", async () => {
    const h = setup();
    const { sessionId } = await arriveAtReconcile(h, "concept-reaffirm");
    const conceptId = "concept-reaffirm";
    await h.service.resolveConflict({ sessionId, expectedVersion: 2, resolution: "affirmed" });
    const snap = h.generateSemanticSnapshot(conceptId);
    expect(snap.history.map((e) => e.type)).toContain("concept.reaffirmed");
    expect(snap.unresolvedConflicts).toHaveLength(0);
  });

  it("revises the active concept while preserving the earlier version", async () => {
    const h = setup();
    const { sessionId } = await arriveAtReconcile(h, "concept-revise");
    await h.service.resolveConflict({
      sessionId,
      expectedVersion: 2,
      resolution: "revised",
      newProposition: "The user values collaboration over independence.",
    });
    const snap = h.generateSemanticSnapshot("concept-revise");
    expect(snap.current.proposition).toBe("The user values collaboration over independence.");
    expect(snap.history.map((e) => e.type)).toContain("concept.revised");
  });

  it("adds context without forcing a contradiction to collapse", async () => {
    const h = setup();
    const { sessionId } = await arriveAtReconcile(h, "concept-context");
    await h.service.resolveConflict({
      sessionId,
      expectedVersion: 2,
      resolution: "contextualized",
      explanation: "I prefer independence at work and support in close relationships.",
      contexts: [
        { context: "work", interpretation: "independence" },
        { context: "close relationships", interpretation: "support" },
      ],
    });
    const snap = h.generateSemanticSnapshot("concept-context");
    expect(snap.current.contexts).toContainEqual({ context: "work", interpretation: "independence" });
    expect(snap.current.contexts).toHaveLength(2);
    expect(snap.unresolvedConflicts).toHaveLength(0);
    expect(snap.history.map((e) => e.type)).toContain("concept.context_added");
  });

  it("allows both claims to coexist", async () => {
    const h = setup();
    const { sessionId } = await arriveAtReconcile(h, "concept-coexist");
    await h.service.resolveConflict({ sessionId, expectedVersion: 2, resolution: "coexisting" });
    const snap = h.generateSemanticSnapshot("concept-coexist");
    expect(snap.history.map((e) => e.type)).toContain("concept.coexisting");
    expect(snap.unresolvedConflicts).toHaveLength(0);
  });

  it("keeps uncertainty unresolved", async () => {
    const h = setup();
    const { sessionId } = await arriveAtReconcile(h, "concept-uncertain");
    await h.service.resolveConflict({ sessionId, expectedVersion: 2, resolution: "uncertain", explanation: "Not sure yet." });
    const snap = h.generateSemanticSnapshot("concept-uncertain");
    expect(snap.history.map((e) => e.type)).toContain("conflict.marked_unresolved");
    expect(snap.unresolvedConflicts.length).toBeGreaterThan(0);
  });

  it("rejects the earlier interpretation without deleting history", async () => {
    const h = setup();
    const { sessionId } = await arriveAtReconcile(h, "concept-reject");
    await h.service.resolveConflict({ sessionId, expectedVersion: 2, resolution: "rejected" });
    const snap = h.generateSemanticSnapshot("concept-reject");
    expect(snap.current.lifecycle).toBe("superseded");
    // the original committed event is still in history — not erased
    expect(snap.history.map((e) => e.type)).toContain("concept.rejected");
  });
});

describe("Article IV — Memory With Integrity", () => {
  it("never removes reconciled events from history", async () => {
    const h = setup();
    // seed a committed concept
    const committed = await h.completedSessionFor("concept-integrity");
    const conceptId = committed.relatedConceptId!;
    const beforeHistoryLen = h.generateSemanticSnapshot(conceptId).history.length;

    const revisit = await h.service.startRevisitSession({ conceptId, trigger: "contradictory_evidence" });
    await h.service.openConflict({ sessionId: revisit.sessionId, expectedVersion: 1, conflict: h.freshConflict({ conceptId }) });
    await h.service.resolveConflict({ sessionId: revisit.sessionId, expectedVersion: 2, resolution: "contextualized", contexts: [{ context: "work", interpretation: "independence" }] });

    const after = h.generateSemanticSnapshot(conceptId);
    expect(after.history.length).toBeGreaterThanOrEqual(beforeHistoryLen);
    expect(after.history.map((e) => e.type)).toContain("concept.committed");
    expect(after.history.map((e) => e.type)).toContain("concept.context_added");
  });
});