import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const PROMOTION_THRESHOLD = 5;

/**
 * Discovers persona trait strings from the calling user's UserProfile that have
 * enough density in the user's PERSONAL library (PersonalNode) to justify
 * promotion to a trait bridge.
 *
 * For each semantic_label that is not yet promoted (no matching PersonalNode
 * with is_trait=true), counts how many PersonalNodes carry that label in their
 * semantic_labels array. Returns candidates sorted by density descending, plus
 * the already-promoted personal trait bridges for UI display.
 *
 * Personal identity boundary: operates only on the calling user's own profile.
 * Density is measured within the personal library — not the shared global
 * ColorNode substrate — so trait promotion respects the personal/global split.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Resolve the profile — only the calling user's own (unless admin + explicit id).
    let profile = null;
    if (body.profile_id) {
      profile = await base44.asServiceRole.entities.UserProfile.get(body.profile_id);
      if (profile && profile.created_by_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Not your profile' }, { status: 403 });
      }
    } else {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({
        created_by_id: user.id,
      });
      if (profiles && profiles.length > 0) {
        profile = profiles[0];
      }
    }

    if (!profile) {
      return Response.json({ candidates: [], promoted: [], threshold: PROMOTION_THRESHOLD });
    }

    // Shapes are treated as semantic labels too — they can be promoted to trait bridges.
    const traitLabels = [...(profile.semantic_labels || []), ...(profile.fav_shapes || [])];

    // Promoted trait bridges live in the personal library (user-scoped → RLS enforced).
    const promotedNodes = await base44.entities.PersonalNode.filter({
      profile_id: profile.id,
      is_trait: true,
    });
    const promoted = promotedNodes.map((n) => ({
      id: n.id,
      name: n.name,
      hex: n.hex,
      x: n.x,
      y: n.y,
      z: n.z,
    }));
    const promotedNames = new Set(promoted.map((p) => p.name));

    // All personal nodes for this profile — used to measure label density.
    const allPersonal = await base44.entities.PersonalNode.filter({ profile_id: profile.id });

    const candidates = [];
    for (const label of traitLabels) {
      if (promotedNames.has(label)) continue;

      let count = 0;
      for (const n of allPersonal) {
        if ((n.semantic_labels || []).includes(label)) count++;
      }
      candidates.push({ trait: label, node_count: count });
    }

    candidates.sort((a, b) => b.node_count - a.node_count);

    return Response.json({
      candidates,
      promoted,
      threshold: PROMOTION_THRESHOLD,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}