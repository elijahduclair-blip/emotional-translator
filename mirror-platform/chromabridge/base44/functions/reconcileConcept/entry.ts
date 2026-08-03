import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import type { ReconciliationResult, TransitionDirectiveType } from "../../shared/semanticSnapshot.ts";

/**
 * Semantic Reconciliation (Stage 8)
 *
 * This is the state-forward algorithm: "Given everything I already believe,
 * does this new evidence require me to reconsider anything?"
 *
 * Input: a concept_id and a triggering hypothesis_id.
 * Output: a ReconciliationResult describing what conflict exists, what
 * competing concepts are affected, and a proposed action.
 *
 * READ-ONLY: This function does NOT mutate the graph or write events.
 * It produces a proposal (a candidate transition). The State Decision
 * engine (Stage 8.5) decides whether to act on it, and applyTransition
 * records the event.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { concept_id, hypothesis_id } = body;

    if (!concept_id || !hypothesis_id) {
      return Response.json({ error: "concept_id and hypothesis_id are required" }, { status: 400 });
    }

    // ── Fetch the concept ────────────────────────────────────────────
    const concept = await base44.asServiceRole.entities.PersistentConcept.get(concept_id);
    if (!concept) {
      return Response.json({ error: "Concept not found" }, { status: 404 });
    }

    // ── Fetch the triggering hypothesis ──────────────────────────────
    const hypothesis = await base44.asServiceRole.entities.SemanticHypothesis.get(hypothesis_id);
    if (!hypothesis) {
      return Response.json({ error: "Hypothesis not found" }, { status: 404 });
    }

    // ── Determine the relation ───────────────────────────────────────
    const isSupporting = (concept.supporting_hypothesis_ids || []).includes(hypothesis_id);
    const isCounter = (concept.active_conflict_ids || []).includes(hypothesis_id);

    let relation: "supports" | "contradicts" | "new";
    if (isSupporting) {
      relation = "supports";
    } else if (isCounter) {
      relation = "contradicts";
    } else {
      const hypothesisText = (hypothesis.proposition || "").toLowerCase();
      const conceptText = (concept.proposition || "").toLowerCase();
      const isRelated = hypothesisText.includes(conceptText.substring(0, 20)) ||
                        conceptText.includes(hypothesisText.substring(0, 20));
      relation = isRelated ? "supports" : "new";
    }

    // ── Fetch competing concepts ────────────────────────────────────
    const competingConceptIds = concept.competing_concept_ids || [];
    const competingConcepts = [];
    for (const id of competingConceptIds) {
      const comp = await base44.asServiceRole.entities.PersistentConcept.get(id);
      if (comp) competingConcepts.push(comp);
    }

    // ── Assess conflict severity ─────────────────────────────────────
    let conflictSeverity = 0;
    let proposedAction: TransitionDirectiveType = "no_change";

    if (relation === "contradicts") {
      const hypothesisConfidence = hypothesis.aggregate_confidence || 0;
      const conceptConfidence = concept.confidence || 0;

      if (hypothesisConfidence > 0.6 && conceptConfidence - hypothesisConfidence < 0.2) {
        conflictSeverity = 0.8;
        proposedAction = "hold_uncertainty";
      } else if (hypothesisConfidence > 0.4) {
        conflictSeverity = 0.5;
        proposedAction = "weaken";
      } else {
        conflictSeverity = 0.3;
        proposedAction = "no_change";
      }
    } else if (relation === "supports") {
      const newConfidence = Math.min(1, (concept.confidence || 0) + 0.1);
      if (newConfidence - concept.confidence > 0.05) {
        conflictSeverity = 0;
        proposedAction = "strengthen";
      }
    }

    // ── Check for competing concepts that may need reconciliation ────
    const isContested = concept.epistemic_condition === "contested" ||
      concept.lifecycle_status === "transitioning" ||
      concept.status === "contested";
    if (isContested && competingConcepts.length > 0) {
      for (const comp of competingConcepts) {
        if (comp.confidence > concept.confidence + 0.2) {
          conflictSeverity = Math.max(conflictSeverity, 0.7);
          proposedAction = "supersede";
        }
      }
    }

    const result: ReconciliationResult = {
      conceptId: concept_id,
      triggeringHypothesisId: hypothesis_id,
      relation,
      conflictSeverity,
      competingConceptIds,
      proposedAction,
      reasoning: buildReasoning(relation, conflictSeverity, proposedAction, concept, hypothesis),
    };

    return Response.json({ reconciliation: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function buildReasoning(
  relation: string,
  severity: number,
  action: string,
  concept: any,
  hypothesis: any
): string {
  if (relation === "contradicts") {
    if (action === "hold_uncertainty") {
      return `Hypothesis "${hypothesis.proposition}" contradicts concept "${concept.proposition}" with high severity (${severity.toFixed(2)}). Both have comparable confidence — holding in uncertainty rather than replacing.`;
    }
    return `Counter-evidence from hypothesis "${hypothesis.proposition}" weakens concept "${concept.proposition}" (severity ${severity.toFixed(2)}).`;
  }
  if (relation === "supports") {
    return `Hypothesis "${hypothesis.proposition}" supports concept "${concept.proposition}". Proposed: strengthen confidence.`;
  }
  return `New hypothesis "${hypothesis.proposition}" is not directly related to concept "${concept.proposition}". No reconciliation needed.`;
}