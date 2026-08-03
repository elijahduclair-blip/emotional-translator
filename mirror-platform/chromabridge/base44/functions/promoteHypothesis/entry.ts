import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PROMOTION_THRESHOLDS } from "../../shared/epistemicAssessment.ts";
import {
  reduceConceptEvents,
  projectionFromRecord,
  projectionToRecord,
  type ConceptEvent,
} from "../../shared/conceptEvents.ts";

/**
 * Promotion Function (Stage 9)
 *
 * Reducer-first write path:
 *   1. Evaluate epistemic policy
 *   2. Build the promotion event payload
 *   3. Reduce the event to get the initial projection
 *   4. Persist the projection (no direct semantic field writes)
 *   5. Persist the event
 *
 * This function does NOT set semantic fields on PersistentConcept directly.
 * All semantic state flows through reduceConceptEvents.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { hypothesis_id } = body;

    if (!hypothesis_id) {
      return Response.json({ error: "hypothesis_id is required" }, { status: 400 });
    }

    const hypothesis = await base44.asServiceRole.entities.SemanticHypothesis.get(hypothesis_id);
    if (!hypothesis) {
      return Response.json({ error: "Hypothesis not found" }, { status: 404 });
    }

    // ── Epistemic Policy Evaluation ───────────────────────────────────
    const threshold = PROMOTION_THRESHOLDS[hypothesis.category] || 0.60;
    const supportingCount = (hypothesis.supporting_evidence_ids || []).length;
    const counterCount = (hypothesis.counter_evidence_ids || []).length;

    if (hypothesis.category === "identity" && supportingCount < 3) {
      return Response.json({
        promoted: false,
        reason: "identity_requires_3_observations",
        current: supportingCount,
        required: 3,
        threshold,
        aggregate_confidence: hypothesis.aggregate_confidence,
      });
    }

    if (hypothesis.aggregate_confidence < threshold) {
      return Response.json({
        promoted: false,
        reason: "below_confidence_threshold",
        current: hypothesis.aggregate_confidence,
        threshold,
      });
    }

    if (hypothesis.status === "contested") {
      return Response.json({
        promoted: false,
        reason: "contested_active_conflict",
        counter_evidence_count: counterCount,
      });
    }

    if (hypothesis.status !== "supported") {
      return Response.json({
        promoted: false,
        reason: "not_in_supported_status",
        current_status: hypothesis.status,
      });
    }

    const now = new Date().toISOString();

    // ── Check for existing persistent concept ─────────────────────────
    const existing = await base44.asServiceRole.entities.PersistentConcept.filter({
      profile_id: hypothesis.profile_id,
      proposition: hypothesis.proposition,
      lifecycle_status: { $nin: ["archived", "superseded"] },
    });

    // Also check legacy status field for older records
    const legacyExisting = existing.length === 0
      ? await base44.asServiceRole.entities.PersistentConcept.filter({
          profile_id: hypothesis.profile_id,
          proposition: hypothesis.proposition,
        })
      : existing;
    const conceptRecord = legacyExisting.find(
      (c: any) => c.lifecycle_status !== "archived" && c.lifecycle_status !== "superseded" &&
        c.status !== "deprecated"
    );

    if (conceptRecord) {
      // ── Reinforce existing concept via confidence_adjusted event ─────
      const previousConfidence = conceptRecord.confidence || 0;
      const newConfidence = hypothesis.aggregate_confidence;
      const streamVersion = (conceptRecord.last_stream_version || 0) + 1;

      const payload = {
        previousValue: previousConfidence,
        newValue: newConfidence,
        delta: newConfidence - previousConfidence,
        causeType: "supporting_evidence",
        evidenceIds: hypothesis.supporting_evidence_ids || [],
        hypothesisIds: [hypothesis.id],
        decisionId: null,
        policyVersion: "1",
      };

      // Create the event
      const event = await base44.asServiceRole.entities.ConceptEvent.create({
        concept_id: conceptRecord.id,
        profile_id: conceptRecord.profile_id,
        event_type: "confidence_adjusted",
        schema_version: "1",
        payload,
        stream_version: streamVersion,
        policy_version: "1",
        rationale_codes: ["existing_concept_reinforced"],
        evidence_ids: hypothesis.supporting_evidence_ids || [],
        hypothesis_ids: [hypothesis.id],
        idempotency_key: `reinforce:${hypothesis.id}:${conceptRecord.id}`,
        applied_at: now,
      });

      // ── Reduce: seed from stored concept + new event ────────────────
      const seed = projectionFromRecord(conceptRecord);
      const reducerEvent: ConceptEvent = {
        id: event.id,
        concept_id: event.concept_id,
        profile_id: event.profile_id,
        event_type: event.event_type as any,
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

      const nextProj = reduceConceptEvents(conceptRecord.id, [reducerEvent], seed);
      if (!nextProj) {
        return Response.json({ error: "Projection reduction failed" }, { status: 500 });
      }

      // ── Persist the reduced projection ─────────────────────────────
      const updated = await base44.asServiceRole.entities.PersistentConcept.update(
        conceptRecord.id,
        projectionToRecord(nextProj)
      );

      // Mark hypothesis as persistent
      await base44.asServiceRole.entities.SemanticHypothesis.update(hypothesis.id, {
        status: "persistent",
        persistent_concept_id: conceptRecord.id,
        last_evaluated_at: now,
      });

      return Response.json({
        promoted: true,
        action: "updated_existing",
        concept: updated,
      });
    }

    // ── Create new concept via reducer-first path ──────────────────────
    const promotionPayload = {
      profileId: hypothesis.profile_id,
      proposition: hypothesis.proposition,
      category: hypothesis.category,
      sourceHypothesisIds: [hypothesis.id],
      initialConflictIds: [],
      competingConceptIds: [],
      initialConfidence: hypothesis.aggregate_confidence,
      initialStability: hypothesis.temporal_stability || 0,
      initialSalience: 0.5,
      initialLifecycleStatus: "emerging" as const,
      validFrom: now,
      promotionThreshold: threshold,
      evidenceIds: hypothesis.supporting_evidence_ids || [],
      decisionId: null,
      policyVersion: "1",
    };

    // ── Reduce: build initial projection from promotion event ─────────
    const tempEvent: ConceptEvent = {
      id: "temp",
      concept_id: "temp",
      profile_id: hypothesis.profile_id,
      event_type: "promoted",
      schema_version: "1",
      payload: promotionPayload,
      stream_version: 1,
      applied_at: now,
      rationale_codes: [],
      evidence_ids: hypothesis.supporting_evidence_ids || [],
      hypothesis_ids: [hypothesis.id],
      idempotency_key: "temp",
      created_date: now,
    };

    const initialProj = reduceConceptEvents("temp", [tempEvent], null);
    if (!initialProj) {
      return Response.json({ error: "Failed to reduce promotion event" }, { status: 500 });
    }

    // ── Persist the projection ───────────────────────────────────────
    const conceptData = projectionToRecord(initialProj);
    const newConcept = await base44.asServiceRole.entities.PersistentConcept.create(conceptData);

    // ── Persist the event with the real concept ID ───────────────────
    await base44.asServiceRole.entities.ConceptEvent.create({
      concept_id: newConcept.id,
      profile_id: hypothesis.profile_id,
      event_type: "promoted",
      schema_version: "1",
      payload: promotionPayload,
      stream_version: 1,
      policy_version: "1",
      rationale_codes: ["promotion_passed_epistemic_policy"],
      evidence_ids: hypothesis.supporting_evidence_ids || [],
      hypothesis_ids: [hypothesis.id],
      idempotency_key: `promotion:${hypothesis.id}:${newConcept.id}`,
      applied_at: now,
    });

    // ── Mark hypothesis as persistent ─────────────────────────────────
    await base44.asServiceRole.entities.SemanticHypothesis.update(hypothesis.id, {
      status: "persistent",
      persistent_concept_id: newConcept.id,
      last_evaluated_at: now,
    });

    return Response.json({
      promoted: true,
      action: "created",
      concept: newConcept,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}