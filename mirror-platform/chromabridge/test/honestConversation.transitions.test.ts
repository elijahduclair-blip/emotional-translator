import { describe, it, expect } from "vitest";
import { setup } from "./lib/harness";
import {
  InvalidSessionTransitionError,
  StaleSessionVersionError,
} from "../base44/shared/honestConversation";

describe("HonestConversationSession transitions", () => {
  it("allows observe → mirror after an observation is submitted", async () => {
    const { service } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "I think I am becoming more independent." });
    expect(s.phase).toBe("mirror");
  });

  it("allows mirror → propose after a mirror is presented", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal({ inference: "You may value independence." }) });
    expect(s.phase).toBe("propose");
  });

  it("allows propose → clarify when the user requests clarification", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "clarify" } });
    expect(s.phase).toBe("clarify");
  });

  it("allows clarify → mirror after revised input", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "clarify" } });
    s = await service.submitClarification({ sessionId: s.sessionId, expectedVersion: s.version, text: "Only in work decisions." });
    expect(s.phase).toBe("mirror");
  });

  it("allows propose → consent only after explicit confirmation", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    expect(s.phase).toBe("consent");
  });

  it("allows consent → commit only for persistent dispositions", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "emerging" });
    expect(s.phase).toBe("commit");
  });

  it("allows consent → complete for transient disposition", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "transient" });
    expect(s.phase).toBe("complete");
  });

  it("allows consent → complete for do_not_remember", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "do_not_remember" });
    expect(s.phase).toBe("complete");
  });

  it("does not allow propose → commit", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    await expect(
      service.commitMemory({ sessionId: s.sessionId, expectedVersion: s.version, idempotencyKey: "k" })
    ).rejects.toThrow();
  });

  it("does not allow observe → consent", async () => {
    const { service } = setup();
    const s = await service.startObservationSession({ userId: "u" });
    await expect(
      service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "emerging" })
    ).rejects.toThrow(InvalidSessionTransitionError);
  });

  it("does not allow completed sessions to mutate", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "transient" });
    await expect(
      service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "more" })
    ).rejects.toThrow(InvalidSessionTransitionError);
  });

  it("does not allow abandoned sessions to mutate", async () => {
    const { service, freshProposal } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "x" });
    s = await service.abandon({ sessionId: s.sessionId, expectedVersion: s.version });
    await expect(
      service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal() })
    ).rejects.toThrow(InvalidSessionTransitionError);
  });

  it("rejects a stale expectedVersion", async () => {
    const { service } = setup();
    const s = await service.startObservationSession({ userId: "u" });
    await expect(
      service.submitObservation({ sessionId: s.sessionId, expectedVersion: 99, text: "x" })
    ).rejects.toThrow(StaleSessionVersionError);
  });

  it("emits conversation events but no ledger events before the commit boundary", async () => {
    const { service, freshProposal, conceptEventStore, conversationEventStore } = setup();
    let s = await service.startObservationSession({ userId: "u" });
    s = await service.submitObservation({ sessionId: s.sessionId, expectedVersion: s.version, text: "I value independence." });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal({ inference: "You value independence." }) });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "clarify", text: "Only at work." } });
    s = await service.presentMirror({ sessionId: s.sessionId, expectedVersion: s.version, proposal: freshProposal({ revision: 2, inference: "You value independence at work." }) });
    s = await service.respondToProposal({ sessionId: s.sessionId, expectedVersion: s.version, response: { type: "confirm" } });
    s = await service.selectDisposition({ sessionId: s.sessionId, expectedVersion: s.version, disposition: "emerging" });

    expect(s.phase).toBe("commit");
    expect(conceptEventStore).toEqual([]);
    expect(conversationEventStore.length).toBeGreaterThan(0);
  });
});