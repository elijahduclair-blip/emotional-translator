import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  computeAggregateConfidence,
  evaluateStatus,
  computeTemporalStability,
  computeRepetitionStrength,
  PROMOTION_THRESHOLDS,
} from "../../shared/epistemicAssessment.ts";

interface LLMInterpretation {
  category: string;
  propositions: Array<{
    text: string;
    relation: "supports" | "contradicts" | "new";
    hypothesis_id?: string;
  }>;
  temporality: string;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      content,
      source_type = "direct_statement",
      context_ids = [],
      conversation_id,
      message_id,
      reliability = 0.8,
      profile_id,
    } = body;

    if (!content || !profile_id) {
      return Response.json({ error: "content and profile_id are required" }, { status: 400 });
    }

    const observedAt = new Date().toISOString();

    // ── Step 1: Create immutable Evidence Record ──────────────────────
    const evidence = await base44.asServiceRole.entities.EvidenceRecord.create({
      content,
      source_type,
      observed_at: observedAt,
      context_ids,
      reliability,
      interpretation_confidence: 0.5, // will be updated after LLM interpretation
      temporality: "unknown",
      provenance_conversation_id: conversation_id,
      provenance_message_id: message_id,
    });

    // ── Step 2: Fetch existing hypotheses for this profile ────────────
    const existingHypotheses = await base44.asServiceRole.entities.SemanticHypothesis.filter({
      profile_id,
      status: { $nin: ["archived", "historical"] },
    });

    // ── Step 3: LLM Interpretation ───────────────────────────────────
    // Ask the LLM: what kind of claim is this, what does it support or
    // contradict existing hypotheses, what propositions does it imply.
    const existingContext = existingHypotheses.map((h) => ({
      id: h.id,
      proposition: h.proposition,
      category: h.category,
      status: h.status,
      aggregate_confidence: h.aggregate_confidence,
    }));

    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an Epistemic Filter. Your job is to interpret an observation and determine what semantic claims it implies.

OBSERVATION:
"${content}"

Source type: ${source_type}
Observed at: ${observedAt}

EXISTING HYPOTHESES for this user profile:
${JSON.stringify(existingContext, null, 2)}

Your tasks:
1. Classify the observation's temporality (momentary, situational, recurring, unknown).
2. Determine what category of claim this is (identity, preference, goal, belief, habit, emotion, relationship, worldview).
3. Determine which propositions this observation supports or contradicts existing hypotheses.
4. If the observation implies a new claim not covered by existing hypotheses, create a "new" proposition.

Return JSON with this shape:
{
  "category": "one of the categories above",
  "temporality": "one of the temporalities above",
  "propositions": [
    { "text": "the claim this observation implies", "relation": "supports|contradicts|new", "hypothesis_id": "the id from EXISTING HYPOTHESES, or null if new" }
  ]
}

Rules:
- For "supports" or "contradicts" relations, you MUST include the "hypothesis_id" field with the exact id of the existing hypothesis from the list above. Copy the id exactly.
- A "supports" relation means this evidence reinforces an existing hypothesis. Use that hypothesis's id.
- A "contradicts" relation means this evidence weakens or opposes an existing hypothesis. Use that hypothesis's id.
- A "new" relation means this observation implies a claim not yet tracked. Set hypothesis_id to null and provide a clear proposition text.
- Be conservative. Do not over-interpret. If unsure, use temporality "unknown".
- For identity claims, require strong evidence. Do not promote jokes or offhand remarks as identity.`,
      response_json_schema: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["identity", "preference", "goal", "belief", "habit", "emotion", "relationship", "worldview"] },
          temporality: { type: "string", enum: ["momentary", "situational", "recurring", "unknown"] },
          propositions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                relation: { type: "string", enum: ["supports", "contradicts", "new"] },
                hypothesis_id: { type: "string" },
              },
              required: ["text", "relation"],
            },
          },
        },
        required: ["category", "temporality", "propositions"],
      },
    });

    const interpretation: LLMInterpretation = llmResponse as LLMInterpretation;

    // ── Step 4: Update evidence with interpretation confidence ────────
    const interpConfidence = interpretation.propositions && interpretation.propositions.length > 0 ? 0.85 : 0.3;
    await base44.asServiceRole.entities.EvidenceRecord.update(evidence.id, {
      interpretation_confidence: interpConfidence,
      temporality: interpretation.temporality || "unknown",
    });

    // ── Step 5: Create or update hypotheses ───────────────────────────
    const hypothesisUpdates: any[] = [];

    for (const prop of interpretation.propositions || []) {
      if (prop.relation === "supports") {
        // Find matching existing hypothesis by ID (returned by LLM)
        const match = prop.hypothesis_id
          ? existingHypotheses.find((h) => h.id === prop.hypothesis_id)
          : existingHypotheses.find(
              (h) => h.proposition.toLowerCase().includes(prop.text.toLowerCase().substring(0, 20)) ||
                     prop.text.toLowerCase().includes(h.proposition.toLowerCase().substring(0, 20))
            );
        if (match) {
          const supportingIds = [...new Set([...(match.supporting_evidence_ids || []), evidence.id])];
          const newRepetition = computeRepetitionStrength(supportingIds.length);
          const newTemporal = computeTemporalStability(observedAt);
          const crossContext = supportingIds.length > 1
            ? Math.min(1, new Set(supportingIds).size / 3)
            : 0.1;

          const updated = {
            ...match,
            supporting_evidence_ids: supportingIds,
            interpretation_confidence: interpConfidence,
            source_reliability: Math.max(match.source_reliability || 0, reliability),
            cross_context_consistency: Math.max(match.cross_context_consistency || 0, crossContext),
            repetition_strength: newRepetition,
            temporal_stability: Math.max(match.temporal_stability || 0, newTemporal),
            last_evaluated_at: observedAt,
          };

          const aggregate = computeAggregateConfidence(updated);
          const newStatus = evaluateStatus(
            match.status,
            aggregate,
            match.category,
            supportingIds.length,
            (match.counter_evidence_ids || []).length
          );

          const result = await base44.asServiceRole.entities.SemanticHypothesis.update(match.id, {
            supporting_evidence_ids: supportingIds,
            interpretation_confidence: interpConfidence,
            source_reliability: updated.source_reliability,
            cross_context_consistency: updated.cross_context_consistency,
            repetition_strength: newRepetition,
            temporal_stability: updated.temporal_stability,
            aggregate_confidence: aggregate,
            status: newStatus,
            last_evaluated_at: observedAt,
          });
          hypothesisUpdates.push({ action: "updated", hypothesis: result });
          continue;
        }
      }

      if (prop.relation === "contradicts") {
        // Find matching existing hypothesis by ID (returned by LLM)
        const match = prop.hypothesis_id
          ? existingHypotheses.find((h) => h.id === prop.hypothesis_id)
          : existingHypotheses.find(
              (h) => h.proposition.toLowerCase().includes(prop.text.toLowerCase().substring(0, 20)) ||
                     prop.text.toLowerCase().includes(h.proposition.toLowerCase().substring(0, 20))
            );
        if (match) {
          const counterIds = [...new Set([...(match.counter_evidence_ids || []), evidence.id])];
          const updated = {
            ...match,
            counter_evidence_ids: counterIds,
            contradiction_pressure: Math.min(1, counterIds.length / 3),
            last_evaluated_at: observedAt,
          };
          const aggregate = computeAggregateConfidence(updated);
          const newStatus = evaluateStatus(
            match.status,
            aggregate,
            match.category,
            (match.supporting_evidence_ids || []).length,
            counterIds.length
          );

          const result = await base44.asServiceRole.entities.SemanticHypothesis.update(match.id, {
            counter_evidence_ids: counterIds,
            contradiction_pressure: updated.contradiction_pressure,
            aggregate_confidence: aggregate,
            status: newStatus,
            last_evaluated_at: observedAt,
          });
          hypothesisUpdates.push({ action: "contested", hypothesis: result });
          continue;
        }
      }

      // "new" relation or no match found — create a new hypothesis
      const newHypo = {
        proposition: prop.text,
        category: interpretation.category,
        supporting_evidence_ids: [evidence.id],
        counter_evidence_ids: [],
        status: "observed",
        interpretation_confidence: interpConfidence,
        source_reliability: reliability,
        cross_context_consistency: 0.0,
        repetition_strength: computeRepetitionStrength(1),
        temporal_stability: 0.0,
        contradiction_pressure: 0.0,
        user_confirmation_strength: 0.0,
        aggregate_confidence: 0.0,
        promotion_policy_id: "default",
        profile_id,
        last_evaluated_at: observedAt,
      };
      const aggregate = computeAggregateConfidence(newHypo);
      newHypo.aggregate_confidence = aggregate;
      newHypo.status = evaluateStatus("observed", aggregate, newHypo.category, 1, 0);

      const created = await base44.asServiceRole.entities.SemanticHypothesis.create(newHypo);
      hypothesisUpdates.push({ action: "created", hypothesis: created });
    }

    return Response.json({
      evidence_id: evidence.id,
      interpretation,
      hypothesis_updates: hypothesisUpdates,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}