/**
 * Constitutional full path — proves the legitimate application path succeeds.
 *
 * Narrower claim than the user-journey test: a durable semantic concept can
 * only emerge through the authorized conversational path. Every pre-commit
 * phase must leave the semantic ledger and the concept projections empty;
 * only an explicit, single-use authorization produces durable meaning.
 */
import { describe, it, expect } from "vitest";
import { createConstitutionalHarness } from "./lib/constitutionalHarness";

describe("Constitutional full path", () => {
  it("allows remembered meaning only after explicit, single-use authorization", async () => {
    const { eventStore, conversation } = createConstitutionalHarness();

    // Phase 1: Observe and hypothesize — durable evidence, but no meaning yet.
    const evidence = await conversation.observeAndHypothesize({
      text: "Lately I've been approaching problems differently.",
    });

    expect(evidence.observation).toBeDefined();
    expect(evidence.hypothesis).toBeDefined();
    expect(evidence.id).toBeDefined();
    expect(eventStore.semanticEvents()).toHaveLength(0);
    expect(eventStore.persistentConcepts()).toHaveLength(0);

    // Phase 2: Mirror and clarify — interpretation exists as a proposal only.
    const session = await conversation.startSession({ evidenceRecordId: evidence.id });

    const originalInference = "You are becoming more deliberate.";
    await conversation.presentMirror(session.id, { inference: originalInference });

    expect(conversation.getSession(session.id).activeProposal).toBeDefined();
    expect(eventStore.semanticEvents()).toHaveLength(0);
    expect(eventStore.persistentConcepts()).toHaveLength(0);

    // The proposal itself cannot be passed directly to the event store.
    await expect(
      eventStore.appendSemanticEvent(conversation.getSession(session.id).activeProposal)
    ).rejects.toThrow();

    // User corrects the mirror — the revised meaning must be what gets committed.
    const revisedInference = "You are pausing before reacting.";
    await conversation.clarify(session.id, "Not faster — more deliberate, like a pause before I respond.");
    await conversation.presentMirror(session.id, { inference: revisedInference, revision: 2 });

    expect(eventStore.semanticEvents()).toHaveLength(0);
    expect(eventStore.persistentConcepts()).toHaveLength(0);

    // Phase 3: Confirm meaning and choose persistence.
    await conversation.respondToProposal(session.id, { type: "confirm" });
    const decision = await conversation.selectDisposition(session.id, "emerging");

    const command = await conversation.prepareCommit(session.id);

    expect(command.authorization.sessionId).toBe(session.id);
    expect(command.authorization.userDecisionEventId).toBe(decision.eventId);
    expect(command.provenance.evidenceIds).toContain(evidence.id);
    expect(command.mutation.payload.proposition).toBe(revisedInference);

    expect(eventStore.semanticEvents()).toHaveLength(0);
    expect(eventStore.persistentConcepts()).toHaveLength(0);

    // Phase 4: Commit — the only step that crosses the boundary.
    const result = await conversation.commitMemory(command);

    expect(result.status).toBe("committed");
    expect(eventStore.semanticEvents()).toHaveLength(1);
    expect(eventStore.persistentConcepts()).toHaveLength(1);

    const concept = eventStore.persistentConcepts()[0];
    expect(concept.lifecycle_status).toBe("emerging");
    expect(concept.proposition).toBe(revisedInference); // not the original inference

    // Provenance: the committed event reconstructs the authorization chain.
    expect(result.provenance).toMatchObject({
      sessionId: session.id,
      userDecisionEventId: decision.eventId,
      evidenceIds: [evidence.id],
      authorizedBy: "user",
      authorizationSource: "honest_conversation",
    });

    // Phase 5: Exact idempotent replay — same command, no duplicate.
    const retry = await conversation.commitMemory(command);
    expect(retry).toEqual(result);
    expect(eventStore.semanticEvents()).toHaveLength(1);
    expect(eventStore.persistentConcepts()).toHaveLength(1);

    // Phase 6: Authorization misuse — same consent, different meaning.
    const alteredCommand = {
      ...command,
      mutation: {
        ...command.mutation,
        payload: { ...command.mutation.payload, proposition: "A different meaning" },
      },
    };

    await expect(conversation.commitMemory(alteredCommand)).rejects.toThrow(/single-use|consumed/i);
    expect(eventStore.semanticEvents()).toHaveLength(1);
    expect(eventStore.persistentConcepts()).toHaveLength(1);
  });
});