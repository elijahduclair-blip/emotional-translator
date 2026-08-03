import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  reduceConceptEvents,
  projectionFromRecord,
  projectionToRecord,
  makeIdempotencyKey,
  type ConceptEventType,
  type ConceptEvent,
} from "../../shared/conceptEvents.ts";
import type { TransitionDirective } from "../../shared/semanticSnapshot.ts";

/**
 * Transition Applier (Stage 8.5 → Stage 7 event)
 *
 * Reducer-first write path:
 *   1. Verify expected stream version (optimistic concurrency)
 *   2. Build the event payload
 *   3. Check idempotency
 *   4. Append event to the concept's stream
 *   5. Reduce: seed from stored concept + new event → next projection
 *   6. Persist the reduced projection (no direct semantic field writes)
 *
 * This is the only function that writes lifecycle events.
 * The State Decision engine produces directives; this function executes them.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { directive } = body as { directive: TransitionDirective };

    if (!directive) {
      return Response.json({ error: "directive is required" }, { status: 400 });
    }

    // ── Fetch the concept ────────────────────────────────────────────
    const concept = await base44.asServiceRole.entities.PersistentConcept.get(directive.conceptId);
    if (!concept) {
      return Response.json({ error: "Concept not found" }, { status: 404 });
    }

    // ── Optimistic concurrency guard ─────────────────────────────────
    const currentVersion = concept.last_stream_version || 0;
    const expectedVersion = directive.metadata.expectedConceptVersion ?? 0;
    if (currentVersion !== expectedVersion) {
      return Response.json({
        applied: false,
        reason: "stale_state",
        expectedVersion,
        actualVersion: currentVersion,
        requiresReconciliation: true,
      }, { status: 409 });
    }

    // ── Map directive type to event type ─────────────────────────────
    const eventType = mapDirectiveToEventType(directive.type);
    if (!eventType) {
      return Response.json({
        applied: false,
        reason: "no_change_directive",
        message: "No-change directives do not produce events.",
      });
    }

    // ── Check idempotency ────────────────────────────────────────────
    const idempotencyKey = makeIdempotencyKey(
      directive.conceptId,
      eventType,
      directive.metadata.decisionId
    );

    const existing = await base44.asServiceRole.entities.ConceptEvent.filter({
      idempotency_key: idempotencyKey,
    });

    if (existing && existing.length > 0) {
      return Response.json({
        applied: false,
        reason: "idempotent_duplicate",
        message: "An event with this idempotency key already exists.",
        existing_event_id: existing[0].id,
      });
    }

    // ── Build the event ──────────────────────────────────────────────
    const appliedAt = new Date().toISOString();
    const streamVersion = currentVersion + 1;
    const payload = buildEventPayload(directive, concept);

    // ── Append event to the stream ───────────────────────────────────
    const event = await base44.asServiceRole.entities.ConceptEvent.create({
      concept_id: directive.conceptId,
      profile_id: concept.profile_id,
      event_type: eventType,
      schema_version: "1",
      payload,
      stream_version: streamVersion,
      decision_id: directive.metadata.decisionId,
      policy_version: directive.metadata.policyVersion,
      rationale_codes: directive.metadata.rationaleCodes,
      evidence_ids: directive.metadata.evidenceIds,
      hypothesis_ids: directive.metadata.hypothesisIds,
      idempotency_key: idempotencyKey,
      applied_at: appliedAt,
    });

    // ── Reduce: seed from stored concept + new event ─────────────────
    const seed = projectionFromRecord(concept);

    const reducerEvent: ConceptEvent = {
      id: event.id,
      concept_id: event.concept_id,
      profile_id: event.profile_id,
      event_type: event.event_type as ConceptEventType,
      schema_version: event.schema_version,
      payload: event.payload,
      stream_version: event.stream_version,
      decision_id: event.decision_id,
      policy_version: event.policy_version,
      rationale_codes: event.rationale_codes || [],
      evidence_ids: event.evidence_ids || [],
      hypothesis_ids: event.hypothesis_ids || [],
      idempotency_key: event.idempotency_key,
      applied_at: event.applied_at,
      created_date: event.created_date,
    };

    const nextProj = reduceConceptEvents(directive.conceptId, [reducerEvent], seed);
    if (!nextProj) {
      return Response.json({ error: "Projection reduction failed" }, { status: 500 });
    }

    // ── Persist the reduced projection ───────────────────────────────
    const updatedConcept = await base44.asServiceRole.entities.PersistentConcept.update(
      concept.id,
      projectionToRecord(nextProj)
    );

    return Response.json({
      applied: true,
      event_id: event.id,
      event_type: eventType,
      concept: updatedConcept,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function mapDirectiveToEventType(type: string): ConceptEventType | null {
  switch (type) {
    case "strengthen": return "confidence_adjusted";
    case "weaken": return "confidence_adjusted";
    case "split": return "split";
    case "merge": return "merged";
    case "supersede": return "superseded";
    case "archive": return "archived";
    case "clarify": return "clarify";
    case "hold_uncertainty": return "hold_uncertainty";
    default: return null;
  }
}

function buildEventPayload(directive: TransitionDirective, concept: any): Record<string, any> {
  const p = directive.payload || {};
  const m = directive.metadata;
  switch (directive.type) {
    case "strengthen":
    case "weaken": {
      const previousValue = p.oldConfidence ?? concept.confidence;
      const newValue = p.newConfidence ?? concept.confidence;
      return {
        previousValue,
        newValue,
        delta: newValue - previousValue,
        causeType: directive.type === "strengthen" ? "supporting_evidence" : "contradictory_evidence",
        evidenceIds: m.evidenceIds,
        hypothesisIds: m.hypothesisIds,
        decisionId: m.decisionId,
        policyVersion: m.policyVersion,
      };
    }
    case "supersede":
      return {
        new_concept_id: p.newConceptId,
        new_concept_proposition: p.newConceptProposition,
        confidence_delta: p.confidenceDelta,
      };
    case "archive":
      return {
        reason: p.reason || "archived_by_policy",
        final_confidence: p.finalConfidence,
      };
    case "clarify":
      return {
        transition_id: `clarify-${directive.metadata.decisionId}`,
        prompt: p.prompt,
      };
    case "hold_uncertainty":
      return {
        tension_description: p.tensionDescription,
        competing_concept_ids: p.competingConceptIds || [],
      };
    case "split":
      return {
        transition_id: `split-${directive.metadata.decisionId}`,
        split_reason: p.reason,
      };
    case "merge":
      return {
        target_concept_id: p.targetConceptId,
      };
    default:
      return p;
  }
}