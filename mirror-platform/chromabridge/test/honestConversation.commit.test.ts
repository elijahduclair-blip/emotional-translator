import { describe, it, expect } from "vitest";
import { setup } from "./lib/harness";

async function arriveAtCommit(h: ReturnType<typeof setup>) {
  const { service, freshProposal } = h;
  const session = await service.startObservationSession({ userId: "u" });
  await service.submitObservation({ sessionId: session.sessionId, expectedVersion: 0, text: "I think I am becoming more independent." });
  await service.submitObservation({ sessionId: session.sessionId, expectedVersion: 1, text: "Mostly when making decisions at work." });
  const proposal = h.freshProposal({
    observationIds: ["obs-1", "obs-2"],
    inference: "The user is gaining confidence making independent decisions at work.",
  });
  await service.presentMirror({ sessionId: session.sessionId, expectedVersion: 2, proposal });
  await service.respondToProposal({ sessionId: session.sessionId, expectedVersion: 3, response: { type: "confirm" } });
  await service.selectDisposition({ sessionId: session.sessionId, expectedVersion: 4, disposition: "emerging" });
  return { sessionId: session.sessionId, proposal };
}

describe("commitMemory", () => {
  it("appends exactly one semantic event", async () => {
    const h = setup();
    const { sessionId } = await arriveAtCommit(h);
    await h.service.commitMemory({ sessionId, expectedVersion: 5, idempotencyKey: "single" });
    const committed = h.conceptEventStore.filter((e) => e.type === "concept.committed");
    expect(committed).toHaveLength(1);
  });

  it("completes the session only after the append succeeds", async () => {
    const h = setup();
    const { sessionId } = await arriveAtCommit(h);
    const res = await h.service.commitMemory({ sessionId, expectedVersion: 5, idempotencyKey: "ok" });
    expect(res.status).toBe("committed");
    expect(res.session.phase).toBe("complete");
  });

  it("does not complete the session when the append fails", async () => {
    const h = setup();
    const { sessionId } = await arriveAtCommit(h);
    h.failNextCommit();
    const res = await h.service.commitMemory({ sessionId, expectedVersion: 5, idempotencyKey: "fail" });
    expect(res.status).toBe("conflict");
    expect(res.session.phase).toBe("consent");
    expect(h.conceptEventStore.filter((e) => e.type === "concept.committed")).toHaveLength(0);
  });

  it("returns the same result when retried with the same idempotency key", async () => {
    const h = setup();
    const { sessionId } = await arriveAtCommit(h);
    const first = await h.service.commitMemory({ sessionId, expectedVersion: 5, idempotencyKey: "retry-1" });
    const second = await h.service.commitMemory({ sessionId, expectedVersion: 5, idempotencyKey: "retry-1" });
    expect(second).toEqual(first);
  });

  it("does not duplicate a concept after a network retry", async () => {
    const h = setup();
    const { sessionId } = await arriveAtCommit(h);
    await h.service.commitMemory({ sessionId, expectedVersion: 5, idempotencyKey: "retry-2" });
    await h.service.commitMemory({ sessionId, expectedVersion: 5, idempotencyKey: "retry-2" });
    expect(h.conceptEventStore.filter((e) => e.type === "concept.committed")).toHaveLength(1);
  });

  it("rejects a stale expectedVersion at commit", async () => {
    const h = setup();
    const { sessionId } = await arriveAtCommit(h);
    await expect(
      h.service.commitMemory({ sessionId, expectedVersion: 999, idempotencyKey: "stale" })
    ).rejects.toThrow();
  });

  it("re-evaluates safely after optimistic concurrency conflict", async () => {
    const h = setup();
    const { sessionId } = await arriveAtCommit(h);
    // first commit fails; session returns to consent; re-select disposition and retry
    h.failNextCommit();
    const failed = await h.service.commitMemory({ sessionId, expectedVersion: 5, idempotencyKey: "oc" });
    expect(failed.status).toBe("conflict");
    expect(failed.session.phase).toBe("consent");
    // user re-selects a persistent disposition and retries with a fresh idempotency key
    await h.service.selectDisposition({ sessionId, expectedVersion: 6, disposition: "ongoing" });
    const retried = await h.service.commitMemory({ sessionId, expectedVersion: 7, idempotencyKey: "oc-2" });
    expect(retried.status).toBe("committed");
    expect(h.conceptEventStore.filter((e) => e.type === "concept.committed")).toHaveLength(1);
  });
});