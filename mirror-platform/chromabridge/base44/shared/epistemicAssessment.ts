/**
 * Epistemic Assessment utilities.
 * Shared by any function that needs to compute confidence dimensions
 * and evaluate hypothesis promotion.
 */

// Weights for each epistemic dimension when computing aggregate confidence.
// These weights encode the Epistemic Policy: repetition alone should not
// create stable state; contradiction pressure is penalized heavily.
export const DIMENSION_WEIGHTS = {
  interpretation_confidence: 0.15,
  source_reliability: 0.10,
  cross_context_consistency: 0.25,
  repetition_strength: 0.10,
  temporal_stability: 0.20,
  contradiction_pressure: -0.25, // negative: more contradiction = less confidence
  user_confirmation_strength: 0.25,
};

// Minimum aggregate confidence required for a hypothesis to be promoted
// to persistent state. Different categories have different thresholds.
export const PROMOTION_THRESHOLDS = {
  identity: 0.75,       // high burden — identity is hard to earn
  worldview: 0.70,
  goal: 0.65,
  belief: 0.65,
  habit: 0.60,
  relationship: 0.65,
  preference: 0.50,     // low burden — preferences are easy to establish
  emotion: 0.55,
};

/**
 * Compute aggregate confidence from epistemic dimensions.
 */
export function computeAggregateConfidence(h: {
  interpretation_confidence: number;
  source_reliability: number;
  cross_context_consistency: number;
  repetition_strength: number;
  temporal_stability: number;
  contradiction_pressure: number;
  user_confirmation_strength: number;
}): number {
  let sum = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    const val = (h as any)[key] || 0;
    sum += val * weight;
    weightSum += Math.abs(weight);
  }
  // Normalize to 0..1
  const raw = sum / weightSum;
  return Math.max(0, Math.min(1, raw));
}

/**
 * Determine the next lifecycle status for a hypothesis based on its
 * epistemic assessment and evidence counts.
 */
export function evaluateStatus(
  currentStatus: string,
  aggregate: number,
  category: string,
  supportingCount: number,
  counterCount: number
): string {
  const threshold = PROMOTION_THRESHOLDS[category] || 0.60;

  // If there are counters and they're significant, mark as contested
  if (counterCount > 0 && counterCount >= supportingCount / 2) {
    return "contested";
  }

  // If enough confidence, mark as supported (not yet persistent —
  // promotion to persistent is a separate policy decision)
  if (aggregate >= threshold && supportingCount >= 2) {
    return "supported";
  }

  // If some evidence exists but not enough confidence
  if (supportingCount >= 1 && aggregate > 0.3) {
    return "candidate";
  }

  // If we have at least one observation but haven't interpreted yet
  if (currentStatus === "observed") {
    return "interpreted";
  }

  return currentStatus;
}

/**
 * Compute temporal stability: how long this hypothesis has been
 * supported relative to now.
 */
export function computeTemporalStability(
  firstObservedAt: string,
  now: Date = new Date()
): number {
  const first = new Date(firstObservedAt).getTime();
  if (isNaN(first)) return 0;
  const daysSince = (now.getTime() - first) / (1000 * 60 * 60 * 24);
  // Saturate at 30 days = full temporal stability
  return Math.min(1, daysSince / 30);
}

/**
 * Compute repetition strength from count of supporting evidence.
 */
export function computeRepetitionStrength(count: number): number {
  // Saturate at 5 observations = full repetition strength
  return Math.min(1, count / 5);
}