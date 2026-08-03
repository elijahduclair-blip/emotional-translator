import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SHAPE_TRAITS = {
  Square: { trait: 'Stability', force: 'gravity' },
  Rectangle: { trait: 'Structure', force: 'gravity' },
  Rhombus: { trait: 'Balance', force: 'gravity' },
  Parallelogram: { trait: 'Movement', force: 'current' },
  Trapezoid: { trait: 'Directionality', force: 'current' },
  Kite: { trait: 'Complexity', force: 'refraction' },
  Irregular: { trait: 'Uniqueness', force: 'refraction' },
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const profileId = body.profile_id;
    const trigger = body.trigger || 'manual';

    if (!profileId) {
      return Response.json({ error: 'profile_id is required' }, { status: 400 });
    }

    // Fetch the profile
    const profiles = await base44.entities.UserProfile.filter({ id: profileId });
    const profile = profiles && profiles[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Gather all shapes from the profile
    const shapes = profile.fav_shapes || [];

    // Also count trait_associations from the graph nodes linked to this profile
    const traitNodeIds = profile.trait_node_ids || [];
    let graphShapeCount = 0;

    // Fetch trait bridge nodes to see what shapes they represent
    if (traitNodeIds.length > 0) {
      for (const nodeId of traitNodeIds.slice(0, 50)) {
        try {
          const nodes = await base44.entities.ColorNode.filter({ id: nodeId });
          if (nodes && nodes[0]) {
            graphShapeCount++;
          }
        } catch {
          // skip individual failures
        }
      }
    }

    // Build distribution from profile shapes
    const dist = {};
    let totalNodes = 0;

    for (const shape of shapes) {
      const entry = SHAPE_TRAITS[shape];
      if (!entry) continue;
      if (!dist[entry.trait]) {
        dist[entry.trait] = { trait: entry.trait, shape, count: 0, force: entry.force };
      }
      dist[entry.trait].count++;
      totalNodes++;
    }

    // Add graph density from trait bridges (each trait bridge adds its weight)
    if (graphShapeCount > 0) {
      // Each trait bridge node contributes to its shape's trait
      for (const shape of shapes) {
        const entry = SHAPE_TRAITS[shape];
        if (!entry) continue;
        if (!dist[entry.trait]) {
          dist[entry.trait] = { trait: entry.trait, shape, count: 0, force: entry.force };
        }
        dist[entry.trait].count += graphShapeCount;
        totalNodes += graphShapeCount;
      }
    }

    // Also scan semantic_labels — each label maps to a trait via the shape index
    const semanticLabels = profile.semantic_labels || [];
    for (const label of semanticLabels) {
      // Semantic labels that match a shape name contribute directly
      const entry = SHAPE_TRAITS[label];
      if (entry) {
        if (!dist[entry.trait]) {
          dist[entry.trait] = { trait: entry.trait, shape: label, count: 0, force: entry.force };
        }
        dist[entry.trait].count++;
        totalNodes++;
      }
    }

    const distribution = Object.values(dist);

    // Compute force counts
    const forceCounts = { gravity: 0, current: 0, refraction: 0 };
    for (const d of distribution) {
      if (forceCounts[d.force] !== undefined) {
        forceCounts[d.force] += d.count;
      }
    }

    // Determine dominant force
    let dominantForce = 'gravity';
    let max = -1;
    for (const [force, count] of Object.entries(forceCounts)) {
      if (count > max) {
        max = count;
        dominantForce = force;
      }
    }

    const now = new Date().toISOString();

    // Create the snapshot record
    const snapshot = await base44.entities.TraitTrackingLog.create({
      profile_id: profileId,
      snapshot_at: now,
      distribution,
      dominant_force: dominantForce,
      force_counts: forceCounts,
      total_nodes: totalNodes,
      trigger,
    });

    return Response.json({
      snapshot,
      distribution,
      dominant_force: dominantForce,
      force_counts: forceCounts,
      total_nodes: totalNodes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}