import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Fetches only the ColorNodes within the star's orbital range — the "Active Crust."
 *
 * Instead of loading all 10k+ nodes, this function:
 * 1. Reads the user's UserProfile to get the current semantic_origin (the star)
 * 2. Fetches all structural nodes (persona, base, trait bridges) unconditionally
 * 3. Fetches non-structural nodes and filters by Euclidean proximity to the star
 * 4. Returns only the orbital set — nodes within the given radius
 *
 * Input: { profile_id?: string, radius?: number }
 * Default radius: 400 (covers most of the -255/255 space around the star)
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const radius = body.radius || 400;
    const radiusSq = radius * radius;

    // 1. Get the star position
    let profile = null;
    if (body.profile_id) {
      profile = await base44.asServiceRole.entities.UserProfile.get(body.profile_id);
    } else {
      // Use the most recent profile
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({}, '-created_date', 1, 0);
      profile = profiles[0] || null;
    }

    if (!profile) {
      return Response.json({ error: 'No UserProfile found. Create a profile first.' }, { status: 404 });
    }

    const starX = profile.semantic_origin_x || 0;
    const starY = profile.semantic_origin_y || 0;
    const starZ = profile.semantic_origin_z || 0;

    // 2. Fetch structural nodes (persona, base, trait bridges) — always included
    const structuralNodes = [];
    let sSkip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter(
        { $or: [
          { tier: 'persona' },
          { tier: 'base' },
          { is_trait: true },
        ]},
        null,
        500,
        sSkip
      );
      structuralNodes.push(...batch);
      if (batch.length < 500) break;
      sSkip += 500;
    }

    // 3. Fetch non-structural active nodes and filter by proximity
    const orbitalNodes = [];
    let checked = 0;
    let nodeSkip = 0;
    while (true) {
      const nodes = await base44.asServiceRole.entities.ColorNode.filter(
        { memory_status: 'active' },
        null,
        500,
        nodeSkip
      );
      if (nodes.length === 0) break;

      for (const node of nodes) {
        // Skip structural nodes (already gathered)
        if (node.tier === 'persona' || node.tier === 'base' || node.is_trait) continue;

        checked++;
        const dx = (node.x || 0) - starX;
        const dy = (node.y || 0) - starY;
        const dz = (node.z || 0) - starZ;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= radiusSq) {
          orbitalNodes.push(node);
        }
      }

      if (nodes.length < 500) break;
      nodeSkip += 500;
    }

    // Deduplicate by ID (structural + orbital might overlap)
    const seen = new Set();
    const allNodes = [];
    for (const n of [...structuralNodes, ...orbitalNodes]) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        allNodes.push(n);
      }
    }

    return Response.json({
      success: true,
      star: { x: starX, y: starY, z: starZ },
      radius,
      total_checked: checked,
      orbital_count: orbitalNodes.length,
      structural_count: structuralNodes.length,
      nodes: allNodes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}