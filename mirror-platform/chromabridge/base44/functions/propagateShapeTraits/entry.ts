import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

const TIER_ORDER = ['base', 'bridge', 'shade', 'words'];

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

    // Lookup maps: node name → trait, node id → trait
    const nameToTrait = new Map();
    const idToTrait = new Map();
    const alreadyHasTrait = new Set();

    // Initialize with nodes that existing shape_trait
    for (const node of allNodes) {
      if (node.shape_trait) {
        nameToTrait.set(node.name, node.shape_trait);
        idToTrait.set(node.id, node.shape_trait);
        alreadyHasTrait.add(node.id);
      }
    }

    // Group by tier for ordered processing
    const byTier = {};
    for (const tier of TIER_ORDER) byTier[tier] = [];
    for (const node of allNodes) {
      if (byTier[node.tier]) byTier[node.tier].push(node);
    }

    const updates = [];
    const stats = { base: 0, bridge: 0, shade: 0, words: 0, skipped: 0 };

    // Look up the most common trait from an array of parent names
    function traitFromParents(parents) {
      if (!parents || parents.length === 0) return null;
      const traits = parents.map(p => nameToTrait.get(p)).filter(Boolean);
      if (traits.length === 0) return null;
      const counts = {};
      for (const t of traits) counts[t] = (counts[t] || 0) + 1;
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }

    function traitFromAnchorId(anchorId) {
      if (!anchorId) return null;
      return idToTrait.get(anchorId);
    }

    function traitFromName(name) {
      const lower = (name || '').toLowerCase();
      for (const [anchor, trait] of Object.entries(ANCHOR_TO_TRAIT)) {
        if (lower.includes(anchor.toLowerCase())) return trait;
      }
      return null;
    }

    function traitFromLabels(labels) {
      if (!labels || labels.length === 0) return null;
      for (const l of labels) {
        if (ANCHOR_TO_TRAIT[l]) return ANCHOR_TO_TRAIT[l];
      }
      return null;
    }

    // Process each tier in order: base → bridge → shade → words
    for (const tier of TIER_ORDER) {
      for (const node of byTier[tier]) {
        if (alreadyHasTrait.has(node.id)) {
          stats.skipped++;
          continue;
        }

        let trait = null;

        if (tier === 'base') {
          trait = traitFromName(node.name)
            || traitFromLabels(node.semantic_labels)
            || traitFromLabels(node.trait_associations)
            || traitFromAnchorId(node.parent_anchor_id)
            || traitFromParents(node.parents);
          if (!trait) {
            if (node.z > 100) trait = 'Movement';
            else if (node.z < -100) trait = 'Stability';
            else if (node.x > 100) trait = 'Directionality';
            else if (node.x < -100) trait = 'Complexity';
            else trait = 'Balance';
          }
        } else if (tier === 'bridge') {
          trait = traitFromParents(node.parents)
            || traitFromAnchorId(node.parent_anchor_id)
            || traitFromLabels(node.trait_associations)
            || traitFromLabels(node.semantic_labels);
          if (!trait) {
            if (node.bridge_transition === 'persona-base') trait = 'Balance';
            else if (node.bridge_transition === 'base-shade') trait = 'Structure';
            else if (node.bridge_transition === 'shade-words') trait = 'Complexity';
            else trait = 'Balance';
          }
        } else if (tier === 'shade') {
          trait = traitFromParents(node.parents)
            || traitFromAnchorId(node.parent_anchor_id)
            || traitFromLabels(node.trait_associations);
          if (!trait) {
            if (node.z > 100) trait = 'Movement';
            else if (node.z < -100) trait = 'Stability';
            else trait = 'Balance';
          }
        } else if (tier === 'words') {
          trait = traitFromParents(node.parents)
            || traitFromAnchorId(node.parent_anchor_id)
            || traitFromLabels(node.trait_associations)
            || traitFromLabels(node.semantic_labels);
          if (!trait) trait = 'Complexity';
        }

        if (trait) {
          nameToTrait.set(node.name, trait);
          idToTrait.set(node.id, trait);
          updates.push({ id: node.id, shape_trait: trait });
          stats[tier]++;
        } else {
          stats.skipped++;
        }
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
      assigned: updates.length,
      updated,
      by_tier: { base: stats.base, bridge: stats.bridge, shade: stats.shade, words: stats.words },
      skipped_already_assigned: stats.skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}