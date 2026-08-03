import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  reduceConceptEvents,
  projectionFromRecord,
  type ConceptEvent,
  type PersistentConceptProjection,
} from "../../shared/conceptEvents.ts";
import { computeTrend } from "../../shared/conceptEvents.ts";
import type {
  TransitionDirective,
  DirectiveMetadata,
  ReconciliationResult,
} from "../../shared/semanticSnapshot.ts";

/**
 * State Decision Engine (Stage 8.5)
 *
 * Pure, idempotent function: given a concept, a reconciliation result,
 * competing concepts, and confidence trajectory, it produces a transition
 * directive that explains itself.
 *
 * Decision space:
 *   no_change → strengthen → weaken → split → merge →
 *   supersede → archive → clarify → hold_uncertainty
 */
const POLICY_VERSION = "1";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { concept_id, reconciliation_result } = body as {
      concept_id: string;
      reconciliation_result: ReconciliationResult;
    };

    if (!concept_id || !reconciliation_result) {
      return Response.json({ error: "concept_id and reconciliation_result are required" }, { status: 400 });
    }

    // ── Fetch the concept and its event history ──────────────────────
    const concept = await base44.asServiceRole.entities.PersistentConcept.get(concept_id);
    if (!concept) {
      return Response.json({ error: "Concept not found" }, { status: 404 });
    }

    const events = await base44.asServiceRole.entities.ConceptEvent.filter({
      concept_id,
    });

    // Build projection from stored concept + events
    const seed = projectionFromRecord(concept);
    const projection = reduceConceptEvents(concept_id, events as ConceptEvent[], seed);
    if (!projection) {
      return Response.json({ error: "Failed to build projection" }, { status: 500 });
    }

    // ── Fetch competing concepts ─────────────────────────────────────
    const competingConcepts: PersistentConceptProjection[] = [];
    for (const id of reconciliation_result.competingConceptIds) {
      const comp = await base44.asServiceRole.entities.PersistentConcept.get(id);
      if (comp) {
        const compSeed = projectionFromRecord(comp);
        const compEvents = await base44.asServiceRole.entities.ConceptEvent.filter({
          concept_id: id,
        });
        const compProj = reduceConceptEvents(id, compEvents as ConceptEvent[], compSeed);
        if (compProj) competingConcepts.push(compProj);
      }
    }

    // ── Fetch relevant hypotheses ────────────────────────────────────
    const hypothesisIds = [...(concept.supporting_hypothesis_ids || []), ...(concept.active_conflict_ids || [])];
    const relevantHypotheses = [];
    for (const hid of hypothesisIds.slice(0, 10)) {
      const h = await base44.asServiceRole.entities.SemanticHypothesis.get(hid);
      if (h) relevantHypotheses.push(h);
    }

    // ── Evaluate the decision ────────────────────────────────────────
    const directive = evaluateDecision(
      projection,
      reconciliation_result,
      competingConcepts,
      relevantHypotheses
    );

    return Response.json({ directive });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function evaluateDecision(
  concept: PersistentConceptProjection,
  reconciliation: ReconciliationResult,
  competingConcepts: PersistentConceptProjection[],
  hypotheses: any[]
): TransitionDirective {
  const decisionId = `decision-${concept.id}-${Date.now()}`;
  const generatedAt = new Date().toISOString();

  const evidenceIds = hypotheses.flatMap((h) => h.supporting_evidence_ids || []);
  const hypothesisIds = hypotheses.map((h) => h.id);
  const rationaleCodes: string[] = [];

  const build = (
    type: TransitionDirective["type"],
    codes: string[],
    payload?: Record<string, any>
  ): TransitionDirective => {
    const metadata: DirectiveMetadata = {
      decisionId,
      policyVersion: POLICY_VERSION,
      rationaleCodes: codes,
      evidenceIds,
      hypothesisIds,
      expectedConceptVersion: concept.last_stream_version || 0,
      generatedAt,
    };
    return { type, conceptId: concept.id, metadata, payload };
  };

  // Rule 1: Hold uncertainty when concepts are in tension with comparable confidence
  if (reconciliation.relation === "contradicts" && reconciliation.conflictSeverity >= 0.7) {
    rationaleCodes.push("R001", "comparable_confidence_tension");
    return build("hold_uncertainty", rationaleCodes, {
      tensionDescription: `Concept "${concept.proposition}" is contested by hypothesis with high severity`,
      competingConceptIds: reconciliation.competingConceptIds,
    });
  }

  // Rule 2: Supersede if a competing concept is significantly stronger
  for (const comp of competingConcepts) {
    if (comp.confidence > concept.confidence + 0.2 && comp.epistemic_condition === "stable") {
      rationaleCodes.push("R002", "competing_concept_dominant");
      return build("supersede", rationaleCodes, {
        newConceptId: comp.id,
        newConceptProposition: comp.proposition,
        confidenceDelta: comp.confidence - concept.confidence,
      });
    }
  }

  // Rule 3: Strengthen if supporting evidence
  if (reconciliation.relation === "supports" && reconciliation.proposedAction === "strengthen") {
    const newConfidence = Math.min(1, concept.confidence + 0.1);
    rationaleCodes.push("R003", "supporting_evidence");
    return build("strengthen", rationaleCodes, {
      oldConfidence: concept.confidence,
      newConfidence,
      cause: "supporting_hypothesis",
    });
  }

  // Rule 4: Weaken if counter-evidence with moderate severity
  if (reconciliation.relation === "contradicts" && reconciliation.conflictSeverity >= 0.4) {
    const newConfidence = Math.max(0, concept.confidence - 0.1);
    rationaleCodes.push("R004", "counter_evidence");
    return build("weaken", rationaleCodes, {
      oldConfidence: concept.confidence,
      newConfidence,
      cause: "contradicting_hypothesis",
    });
  }

  // Rule 5: Archive if confidence is very low and concept has been low for a while
  const { trend } = computeTrend(concept.confidence_history);
  if (concept.confidence < 0.2 && concept.confidence_history.length > 3 && trend === "falling") {
    rationaleCodes.push("R005", "low_confidence_sustained");
    return build("archive", rationaleCodes, {
      reason: "Confidence below 0.2 with falling trend",
      finalConfidence: concept.confidence,
    });
  }

  // Rule 6: Clarify if pending transitions exist
  if (concept.pending_transition_ids.length > 0) {
    rationaleCodes.push("R006", "pending_transition");
    return build("clarify", rationaleCodes, {
      pendingTransitionIds: concept.pending_transition_ids,
      prompt: `Clarify: Is "${concept.proposition}" still relevant?`,
    });
  }

  // Rule 7: No change
  rationaleCodes.push("R000", "no_action_needed");
  return build("no_change", rationaleCodes);
}