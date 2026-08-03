import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SHAPE_TRAIT_MAP = {
  Stability: { shape: 'Square', force: 'gravity' },
  Structure: { shape: 'Rectangle', force: 'gravity' },
  Balance: { shape: 'Rhombus', force: 'gravity' },
  Movement: { shape: 'Parallelogram', force: 'current' },
  Directionality: { shape: 'Trapezoid', force: 'current' },
  Complexity: { shape: 'Kite', force: 'refraction' },
  Uniqueness: { shape: 'Irregular', force: 'refraction' },
};

const ANCHOR_TO_TRAIT = {
  Protect: 'Stability',
  Trust: 'Stability',
  Structure: 'Structure',
  Light: 'Structure',
  Balance: 'Balance',
  Growth: 'Balance',
  Hope: 'Movement',
  Fear: 'Movement',
  Danger: 'Directionality',
  Shadow: 'Complexity',
  Stability: 'Stability',
  Fluidity: 'Movement',
  Resonance: 'Balance',
  Precision: 'Structure',
  Adaptability: 'Movement',
  Intensity: 'Complexity',
  Calm: 'Stability',
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all nodes in paginated batches
    const allNodes = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter({}, '-created_date', 500, skip);
      allNodes.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    // Build update batches for nodes that need shape_trait assignment
    const updates = [];
    let assigned = 0;
    let skipped = 0;

    for (const node of allNodes) {
      // Skip if already has a shape_trait
      if (node.shape_trait) {
        skipped++;
        continue;
      }

      let inferredTrait = null;

      // 1. Check trait_associations for shape-trait matches
      if (node.trait_associations && node.trait_associations.length > 0) {
        for (const ta of node.trait_associations) {
          if (ANCHOR_TO_TRAIT[ta]) {
            inferredTrait = ANCHOR_TO_TRAIT[ta];
            break;
          }
        }
      }

      // 2. Check semantic_labels for trait matches
      if (!inferredTrait && node.semantic_labels && node.semantic_labels.length > 0) {
        for (const sl of node.semantic_labels) {
          if (ANCHOR_TO_TRAIT[sl]) {
            inferredTrait = ANCHOR_TO_TRAIT[sl];
            break;
          }
        }
      }

      // 3. Infer from tier + name heuristics
      if (!inferredTrait) {
        const name = (node.name || '').toLowerCase();
        if (node.tier === 'base') {
          // Base anchors map by their name
          for (const [anchor, trait] of Object.entries(ANCHOR_TO_TRAIT)) {
            if (name.includes(anchor.toLowerCase())) {
              inferredTrait = trait;
              break;
            }
          }
        }
        if (!inferredTrait && node.tier === 'bridge') {
          // Bridge nodes: infer from bridge_transition
          if (node.bridge_transition === 'persona-base') inferredTrait = 'Balance';
          else if (node.bridge_transition === 'base-shade') inferredTrait = 'Structure';
          else if (node.bridge_transition === 'shade-words') inferredTrait = 'Complexity';
        }
        if (!inferredTrait && node.tier === 'shade') {
          // Shade nodes: infer from z-axis position
          if (node.z > 100) inferredTrait = 'Movement';
          else if (node.z < -100) inferredTrait = 'Stability';
          else inferredTrait = 'Balance';
        }
        if (!inferredTrait && node.tier === 'words') {
          inferredTrait = 'Complexity';
        }
      }

      if (inferredTrait) {
        updates.push({ id: node.id, shape_trait: inferredTrait });
        assigned++;
      }
    }

    // Apply updates in batches of 500
    let updated = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(batch);
      updated += batch.length;
    }

    return Response.json({
      total_nodes: allNodes.length,
      assigned,
      updated,
      skipped_already_assigned: skipped,
      unassigned: allNodes.length - assigned - skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}