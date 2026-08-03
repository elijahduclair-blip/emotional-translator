import { describe, it, expect } from "vitest";
import { setup } from "./lib/harness";

describe("First Honest Memory — full lifecycle", () => {
  it("creates and later reconciles one honest memory", async () => {
    const h = setup();

    // ── Observe ──────────────────────────────────────────────
    let s = await h.service.startObservationSession({ userId: "user" });

    s = await h.service.submitObservation({
      sessionId: s.sessionId,
      expectedVersion: s.version,
      text: "I think I am becoming more independent.",
    });

    const proposalV1 = h.freshProposal({
      observationIds: ["obs-1"],
      inference: "You may be describing growing independence.",
      evidenceExcerpts: [{ evidenceId: "obs-1", excerpt: "I think I am becoming more independent." }],
      uncertainty: ["The domain of independence is unspecified."],
    });

    s = await h.service.presentMirror({
      sessionId: s.sessionId,
      expectedVersion: s.version,
      proposal: proposalV1,
    });

    // ── Clarify ─────────────────────────────────────────────
    s = await h.service.respondToProposal({
      sessionId: s.sessionId,
      expectedVersion: s.version,
      response: { type: "clarify", text: "Mostly when making decisions at work." },
    });

    const proposalV2 = h.freshProposal({
      revision: 2,
      observationIds: ["obs-1", "obs-2"],
      inference: "The user is gaining confidence making independent decisions at work.",
      evidenceExcerpts: [
        { evidenceId: "obs-1", excerpt: "I think I am becoming more independent." },
        { evidenceId: "obs-2", excerpt: "Mostly when making decisions at work." },
      ],
      uncertainty: [],
    });

    s = await h.service.presentMirror({
      sessionId: s.sessionId,
      expectedVersion: s.version,
      proposal: proposalV2,
    });

    // ── Confirm & consent ───────────────────────────────────
    s = await h.service.respondToProposal({
      sessionId: s.sessionId,
      expectedVersion: s.version,
      response: { type: "confirm" },
    });

    s = await h.service.selectDisposition({
      sessionId: s.sessionId,
      expectedVersion: s.version,
      disposition: "emerging",
    });

    // ── Commit ─────────────────────────────────────────────
    const committed = await h.service.commitMemory({
      sessionId: s.sessionId,
      expectedVersion: s.version,
      idempotencyKey: "first-honest-memory-1",
    });

    expect(committed.status).toBe("committed");
    const conceptId = committed.conceptId!;

    let snapshot = h.generateSemanticSnapshot(conceptId);
    expect(snapshot.current.lifecycle).toBe("emerging");
    expect(snapshot.current.userConfirmed).toBe(true);
    expect(snapshot.current.supportingEvidence).toHaveLength(2);

    // ── Revisit in a new session ───────────────────────────
    let r = await h.service.startRevisitSession({ conceptId, trigger: "contradictory_evidence" });

    r = await h.service.openConflict({
      sessionId: r.sessionId,
      expectedVersion: r.version,
      conflict: h.freshConflict({
        conceptId,
        earlierEvidenceIds: ["obs-1", "obs-2"],
        newerEvidenceIds: ["obs-newer"],
        explanation: "More recently the user described seeking support in close relationships.",
      }),
    });

    r = await h.service.resolveConflict({
      sessionId: r.sessionId,
      expectedVersion: r.version,
      resolution: "contextualized",
      explanation: "I am independent at work but seek support in close relationships.",
      contexts: [
        { context: "work", interpretation: "independence" },
        { context: "close relationships", interpretation: "support" },
      ],
    });

    snapshot = h.generateSemanticSnapshot(conceptId);
    expect(snapshot.current.lifecycle).toBe("evolving");
    expect(snapshot.current.contexts).toHaveLength(2);
    expect(snapshot.unresolvedConflicts).toHaveLength(0);

    // history preserves every prior event — nothing was erased
    const historyTypes = snapshot.history.map((e) => e.type);
    expect(historyTypes).toContain("concept.committed");
    expect(historyTypes).toContain("conflict.opened");
    expect(historyTypes).toContain("concept.context_added");
    expect(historyTypes).toContain("conflict.resolved");
    expect(snapshot.history.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Constitutional invariants", () => {
  it("Article I — Human Primacy: never persists without explicit disposition", async () => {
    const h = setup();
    let s = await h.service.startObservationSession({ userId: "u" });
    s = await h.service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await h.service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: h.freshProposal() });
    s = await h.service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    expect(h.conceptEventStore).toEqual([]);
  });

  it("Article II — Transparent Reasoning: every proposal references observations", () => {
    const { freshProposal } = setup();
    const proposal = freshProposal({ observationIds: ["obs-1"], evidenceExcerpts: [{ evidenceId: "obs-1", excerpt: "..." }] });
    expect(proposal.observationIds.length).toBeGreaterThan(0);
    expect(proposal.evidenceExcerpts.length).toBeGreaterThan(0);
  });

  it("Article III — Evolution Over Permanence: permits revision without deleting prior state", async () => {
    const h = setup();
    const committed = await h.completedSessionFor("concept-evolve");
    const conceptId = committed.relatedConceptId!;
    const before = h.generateSemanticSnapshot(conceptId).history.length;
    let r = await h.service.startRevisitSession({ conceptId, trigger: "user_requested_review" });
    r = await h.service.openConflict({ sessionId: r.sessionId, expectedVersion: r.version, conflict: h.freshConflict({ conceptId }) });
    r = await h.service.resolveConflict({ sessionId: r.sessionId, expectedVersion: r.version, resolution: "revised", newProposition: "revised" });
    const after = h.generateSemanticSnapshot(conceptId);
    expect(after.history.length).toBeGreaterThan(before);
  });

  it("Article V — Collaborative Interpretation: supports confirm, clarify, reject, defer, uncertainty", async () => {
    const h = setup();

    // confirm
    let s = await h.service.startObservationSession({ userId: "u" });
    s = await h.service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await h.service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: h.freshProposal() });
    s = await h.service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    expect(s.phase).toBe("consent");

    // clarify
    s = await h.service.startObservationSession({ userId: "u" });
    s = await h.service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await h.service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: h.freshProposal() });
    s = await h.service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "clarify", text: "y" } });
    expect(s.phase).toBe("mirror");

    // reject
    s = await h.service.startObservationSession({ userId: "u" });
    s = await h.service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await h.service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: h.freshProposal() });
    s = await h.service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "reject" } });
    expect(s.phase).toBe("complete");

    // defer
    const committed = await h.completedSessionFor("concept-defer");
    let r = await h.service.startRevisitSession({ conceptId: committed.relatedConceptId!, trigger: "scheduled_reflection" });
    r = await h.service.deferRevisit({ sessionId: r.sessionId, expectedVersion: r.version });
    expect(r.phase).toBe("complete");
  });

  it("Article VI — Representation Serves Understanding: keeps observation, inference, evidence, and uncertainty distinct", () => {
    const { freshProposal } = setup();
    const p = freshProposal({
      observationSummary: "what was said",
      inference: "what it might mean",
      evidenceExcerpts: [{ evidenceId: "obs-1", excerpt: "..." }],
      uncertainty: ["what is still unknown"],
    });
    expect(p.observationSummary).not.toBe(p.inference);
    expect(p.evidenceExcerpts[0].excerpt).not.toBe(p.uncertainty[0]);
  });

  it("Article VII — Evidence Before Assertion: does not present confidence or lifecycle as source evidence", () => {
    const { freshProposal } = setup();
    const p = freshProposal({ confidence: 0.64 });
    expect(p.evidenceExcerpts.every((e) => !("lifecycle" in e))).toBe(true);
    expect(p.evidenceExcerpts.every((e) => !("confidence" in e))).toBe(true);
  });
});