import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Promotes a persona trait string (from a UserProfile's semantic_labels) into a
 * trait bridge node in the user's PERSONAL library (PersonalNode) — NOT the
 * shared global ColorNode substrate. The trait bridge is tethered to the shared
 * substrate via source_global_node_id (the nearest global base anchor), but it
 * lives in and is owned by the user. The Librarian never touches it.
 *
 * Personal identity boundary: this function only operates on the calling user's
 * own profile. PersonalNodes are created user-scoped so created_by_id is stamped
 * to the owner (RLS keeps them private to the user).
 *
 * Input: { trait_name: string, profile_id: string }
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { trait_name, profile_id } = body;
    if (!trait_name || !profile_id) {
      return Response.json({ error: 'trait_name and profile_id required' }, { status: 400 });
    }

    // Personal identity boundary: the profile must belong to the calling user.
    const profile = await base44.asServiceRole.entities.UserProfile.get(profile_id);
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Not your profile' }, { status: 403 });
    }

    // Check the personal library for an existing trait bridge (user-scoped → RLS enforced).
    const existing = await base44.entities.PersonalNode.filter({
      name: trait_name,
      is_trait: true,
      profile_id,
    });
    if (existing && existing.length > 0) {
      return Response.json({ already_exists: true, node: existing[0] });
    }

    // LLM positioning — coordinates + nearest global base anchor + hex.
    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a semantic positioning engine for ChromaBridge, a 3-axis color space that maps concepts onto coordinates.

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

Trait descriptor: "${trait_name}"

Determine:
1. x, y, z coordinates that reflect this trait's semantic position in the space
2. The nearest base anchor name (must be one of: Protect, Danger, Hope, Shadow, Light, Growth, Fear, Trust)
3. A hex color (e.g. #RRGGBB) that visually represents this trait

Return JSON.`,
      response_json_schema: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' },
          anchor: { type: 'string' },
          hex: { type: 'string' },
        },
        required: ['x', 'y', 'z', 'anchor', 'hex'],
      },
    });

    const x = Math.round(llmResponse.x) || 0;
    const y = Math.round(llmResponse.y) || 0;
    const z = Math.round(llmResponse.z) || 0;
    const anchorName = llmResponse.anchor || 'Light';
    const hex = llmResponse.hex || '#888888';

    // Tether the personal trait bridge to the shared substrate: find the global
    // base anchor node by name so this personal node references the canonical graph.
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
      name: trait_name,
      hex,
      x,
      y,
      z,
      tier: 'bridge',
      bridge_transition: 'persona-base',
      parents: [anchorName],
      semantic_labels: ['trait', 'persona-base', trait_name],
      profile_id,
      source_global_node_id: sourceGlobalNodeId,
      is_trait: true,
      favorite: true,
      memory_status: 'active',
      access_count: 0,
      insight: `Trait bridge promoted from persona semantic label "${trait_name}", anchored to global base "${anchorName}".`,
    });

    // Track the personal trait node on the profile (trait_node_ids now stores PersonalNode IDs).
    const traitNodeIds = profile.trait_node_ids || [];
    if (!traitNodeIds.includes(node.id)) {
      traitNodeIds.push(node.id);
      await base44.asServiceRole.entities.UserProfile.update(profile_id, {
        trait_node_ids: traitNodeIds,
      });
    }

    return Response.json({ success: true, node });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}