import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Promotes ALL un-promoted persona traits for the CALLING USER's profile into
 * trait bridge nodes in their PERSONAL library (PersonalNode) — NOT the shared
 * global ColorNode substrate. Bypasses the density threshold.
 *
 * Personal identity boundary: this function operates only on the calling user's
 * own profile (or, if the caller is an admin, an explicitly passed profile_id).
 * PersonalNodes are created user-scoped so created_by_id is stamped to the
 * owner and RLS keeps them private. The Librarian never touches these nodes.
 *
 * Input: { profile_id?: string } — if omitted, the calling user's own profile is used.
 */
const LLM_PROMPT = (traitName) => `You are a semantic positioning engine for ChromaBridge, a 3-axis color space that maps concepts onto coordinates.

Given a personal persona trait descriptor, determine its semantic coordinates in this space.

Axes:
- X: -255 (abstract/cool) to 255 (concrete/warm)
- Y: 0 (general/dim) to 255 (specific/bright)
- Z: -255 (passive/muted) to 255 (active/vivid)

Base anchors (choose the single nearest one by semantic meaning):
- Protect: structured, defensive, orderly, secure
- Danger: volatile, threatening, urgent, exposed
- Hope: optimistic, forward-looking, warm, aspiring
- Shadow: hidden, obscure, dark, withdrawn
- Light: revealing, bright, clear, illuminating
- Growth: expansive, evolving, constructive, generative
- Fear: apprehensive, dark, repressed, anxious
- Trust: reliable, grounded, stable, confident

Trait descriptor: "${traitName}"

Determine:
1. x, y, z coordinates that reflect this trait's semantic position in the space
2. The nearest base anchor name (must be one of: Protect, Danger, Hope, Shadow, Light, Growth, Fear, Trust)
3. A hex color (e.g. #RRGGBB) that visually represents this trait

Return JSON.`;

const LLM_SCHEMA = {
  type: 'object',
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    z: { type: 'number' },
    anchor: { type: 'string' },
    hex: { type: 'string' },
  },
  required: ['x', 'y', 'z', 'anchor', 'hex'],
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetProfileId = body.profile_id;

    // Resolve the profile to process — only the calling user's own profile
    // (or an explicitly passed one, if the caller is an admin).
    let profile = null;
    if (targetProfileId) {
      profile = await base44.asServiceRole.entities.UserProfile.get(targetProfileId);
      if (profile && profile.created_by_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Not your profile' }, { status: 403 });
      }
    } else {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by_id: user.id });
      profile = profiles && profiles.length > 0 ? profiles[0] : null;
    }
    if (!profile) {
      return Response.json({ success: true, promoted: 0, skipped: 0, results: [], message: 'No profile found for the calling user.' });
    }

    const traitLabels = profile.semantic_labels || [];
    if (traitLabels.length === 0) {
      return Response.json({ success: true, promoted: 0, skipped: 0, results: [] });
    }

    // Already-promoted trait bridges in the personal library (user-scoped → RLS enforced).
    const existing = await base44.entities.PersonalNode.filter({
      profile_id: profile.id,
      is_trait: true,
    });
    const existingNames = new Set(existing.map((n) => n.name));

    const results = [];
    let promoted = 0;
    let skipped = 0;

    for (const traitName of traitLabels) {
      if (existingNames.has(traitName)) {
        skipped++;
        continue;
      }
      try {
        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: LLM_PROMPT(traitName),
          response_json_schema: LLM_SCHEMA,
        });

        const x = Math.round(llmResponse.x) || 0;
        const y = Math.round(llmResponse.y) || 0;
        const z = Math.round(llmResponse.z) || 0;
        const anchorName = llmResponse.anchor || 'Light';
        const hex = llmResponse.hex || '#888888';

        // Tether to the shared substrate: nearest global base anchor node.
        let sourceGlobalNodeId = null;
        try {
          const anchorNodes = await base44.asServiceRole.entities.ColorNode.filter({
            name: anchorName,
            tier: 'base',
          });
          if (anchorNodes && anchorNodes.length > 0) sourceGlobalNodeId = anchorNodes[0].id;
        } catch { /* best-effort tether */ }

        // Create the trait bridge in the PERSONAL library (user-scoped → owned by the user).
        const node = await base44.entities.PersonalNode.create({
          name: traitName,
          hex,
          x,
          y,
          z,
          tier: 'bridge',
          bridge_transition: 'persona-base',
          parents: [anchorName],
          semantic_labels: ['trait', 'persona-base', traitName],
          profile_id: profile.id,
          source_global_node_id: sourceGlobalNodeId,
          is_trait: true,
          favorite: true,
          memory_status: 'active',
          access_count: 0,
          insight: `Trait bridge promoted from persona semantic label "${traitName}", anchored to global base "${anchorName}".`,
        });

        const traitNodeIds = profile.trait_node_ids || [];
        if (!traitNodeIds.includes(node.id)) {
          traitNodeIds.push(node.id);
          await base44.asServiceRole.entities.UserProfile.update(profile.id, {
            trait_node_ids: traitNodeIds,
          });
        }

        existingNames.add(traitName);
        promoted++;
        results.push({ trait: traitName, status: 'promoted', hex, anchor: anchorName });
      } catch (e) {
        results.push({ trait: traitName, status: 'error', error: e.message });
      }
    }

    return Response.json({
      success: true,
      promoted,
      skipped,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}