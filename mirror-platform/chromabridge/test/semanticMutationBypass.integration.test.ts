/**
 * Semantic mutation bypass — proves known application shortcuts fail.
 *
 * Every path that is not "a committed conversation session authorizing a
 * semantic mutation through the boundary" must be rejected.
 */
import { describe, it, expect } from "vitest";
import { createConstitutionalHarness } from "./lib/constitutionalHarness";

describe("Semantic mutation bypass attempts", () => {
  it("rejects direct Epistemic Lab promotion without a conversation session", async () => {
    const { mutationService, eventStore } = createConstitutionalHarness();

    await expect(
      mutationService.commit({
        mutation: { type: "promote", conceptId: "c1", payload: { proposition: "Direct promotion" } },
        conversationSessionId: "",
        userDecisionEventId: "",
        authorizerId: "user",
        evidenceIds: ["e1"],
        expectedStreamVersion: 0,
        idempotencyKey: "lab-promote-1",
      })
    ).rejects.toThrow();
    expect(eventStore.semanticEvents()).toHaveLength(0);
  });

  it("rejects applyTransition split / merge / supersede / archive without authorization", async () => {
    const { mutationService, eventStore } = createConstitutionalHarness();

    for (const type of ["split", "merge", "supersede", "archive"] as const) {
      await expect(
        mutationService.commit({
          mutation: { type, conceptId: "c1", payload: {} },
          conversationSessionId: "",
          userDecisionEventId: "",
          authorizerId: "user",
          evidenceIds: [],
          expectedStreamVersion: 0,
          idempotencyKey: `transition-${type}`,
        })
      ).rejects.toThrow();
    }
    expect(eventStore.semanticEvents()).toHaveLength(0);
  });

  it("rejects a direct event-store append lacking authorization metadata", async () => {
    const { eventStore } = createConstitutionalHarness();

    await expect(
      eventStore.appendSemanticEvent({
        id: "x", conceptId: "c1", mutationType: "promote", eventType: "promoted", payload: {},
        streamVersion: 1, appliedAt: new Date().toISOString(),
      })
    ).rejects.toThrow();
    expect(eventStore.semanticEvents()).toHaveLength(0);
  });

  it("rejects an append with a non-honest-conversation source", async () => {
    const { eventStore } = createConstitutionalHarness();

    await expect(
      eventStore.appendSemanticEvent({
        id: "x", conceptId: "c1", mutationType: "promote", eventType: "promoted", payload: {},
        streamVersion: 1,
        authorization: { authorizationId: "a", source: "admin_panel", sessionId: "s", userDecisionEventId: "d", idempotencyKey: "k" },
        authorizerId: "user", evidenceIds: ["e1"], appliedAt: new Date().toISOString(),
      })
    ).rejects.toThrow();
    expect(eventStore.semanticEvents()).toHaveLength(0);
  });

  it("rejects an integrity operation disguised as a semantic commit", async () => {
    const { mutationService, eventStore } = createConstitutionalHarness();

    await expect(
      mutationService.commit({
        mutation: { type: "rebuild_projection" as any, conceptId: "c1", payload: {} },
        conversationSessionId: "s", userDecisionEventId: "d", authorizerId: "user",
        evidenceIds: ["e1"], expectedStreamVersion: 0, idempotencyKey: "disguised-1",
      })
    ).rejects.toThrow();
    expect(eventStore.semanticEvents()).toHaveLength(0);
  });

  it("rejects a semantic mutation routed through the integrity path", async () => {
    const { mutationService, eventStore } = createConstitutionalHarness();

    await expect(
      mutationService.runIntegrity({ operation: "merge" as any, provesNoMeaningChange: true, conceptId: "c1" })
    ).rejects.toThrow();
    expect(eventStore.semanticEvents()).toHaveLength(0);
  });
});