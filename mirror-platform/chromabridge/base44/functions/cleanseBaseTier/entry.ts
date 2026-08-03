import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Cleanses the Base tier:
 * 1. Demotes all base-tier nodes that are NOT one of the 8 canonical anchors to tier:'words'.
 * 2. Ensures the 8 canonical anchors exist at their canonical coordinates.
 * 3. Wires polar-opposite pairs on the anchors.
 */

const CANONICAL_ANCHORS = [
  { name: 'Protect', hex: '#5C6BC0', x: 140,  y: 170, z: 220,  opposite: 'Danger' },
  { name: 'Danger',  hex: '#EF5350', x: 160,  y: 100, z: -150, opposite: 'Protect' },
  { name: 'Hope',    hex: '#FFD54F', x: -120, y: 180, z: 160,  opposite: 'Fear' },
  { name: 'Shadow',  hex: '#3A3A4A', x: -180, y: 60,  z: -180, opposite: 'Light' },
  { name: 'Light',   hex: '#FFF59D', x: 120,  y: 240, z: 150,  opposite: 'Shadow' },
  { name: 'Growth',  hex: '#66BB6A', x: 160,  y: 210, z: 200,  opposite: 'Fear' },
  { name: 'Fear',    hex: '#7E57C2', x: -140, y: 90,  z: -200, opposite: 'Hope' },
  { name: 'Trust',   hex: '#42A5F5', x: -100, y: 170, z: -120, opposite: 'Protect' },
];

const CANONICAL_NAMES = new Set(CANONICAL_ANCHORS.map(a => a.name.toLowerCase()));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch ALL base nodes (paginate to be safe)
    const allBaseNodes = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter({ tier: 'base' }, '-created_date', 500, skip);
      allBaseNodes.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    // Partition: canonical anchors vs polluted nodes to demote
    const toDemote = allBaseNodes.filter(n => !CANONICAL_NAMES.has(n.name.toLowerCase()));
    const existingCanonical = allBaseNodes.filter(n => CANONICAL_NAMES.has(n.name.toLowerCase()));
    const existingByName = new Map(existingCanonical.map(n => [n.name.toLowerCase(), n]));

    // Demote polluted base nodes to 'words' tier
    let demoted = 0;
    const demoteIds = toDemote.map(n => n.id);
    if (demoteIds.length > 0) {
      // updateMany requires a query + $set; use bulkUpdate with per-id tier change
      const updates = toDemote.map(n => ({ id: n.id, tier: 'words' }));
      // bulkUpdate cap is 500 per call
      for (let i = 0; i < updates.length; i += 500) {
        await base44.asServiceRole.entities.ColorNode.bulkUpdate(updates.slice(i, i + 500));
      }
      demoted = toDemote.length;
    }

    // Ensure canonical anchors exist or are at correct coords
    const toCreate = [];
    const toFix = [];
    for (const anchor of CANONICAL_ANCHORS) {
      const existing = existingByName.get(anchor.name.toLowerCase());
      if (!existing) {
        toCreate.push({
          name: anchor.name,
          hex: anchor.hex,
          x: anchor.x,
          y: anchor.y,
          z: anchor.z,
          tier: 'base',
          semantic_labels: ['canonical-anchor'],
          opposites: [anchor.opposite],
          parents: [],
        });
      } else {
        // Fix coordinates/labels if drifted
        const needsFix =
          existing.x !== anchor.x ||
          existing.y !== anchor.y ||
          existing.z !== anchor.z ||
          existing.hex !== anchor.hex ||
          !(existing.semantic_labels || []).includes('canonical-anchor');
        if (needsFix) {
          toFix.push({
            id: existing.id,
            hex: anchor.hex,
            x: anchor.x,
            y: anchor.y,
            z: anchor.z,
            semantic_labels: [...new Set([...(existing.semantic_labels || []), 'canonical-anchor'])],
            opposites: [...new Set([...(existing.opposites || []), anchor.opposite])],
          });
        }
      }
    }

    let createdCount = 0;
    if (toCreate.length > 0) {
      const created = await base44.asServiceRole.entities.ColorNode.bulkCreate(toCreate);
      createdCount = Array.isArray(created) ? created.length : 1;
    }

    if (toFix.length > 0) {
      await base44.asServiceRole.entities.ColorNode.bulkUpdate(toFix);
    }

    return Response.json({
      success: true,
      base_nodes_before: allBaseNodes.length,
      demoted_to_words: demoted,
      anchors_created: createdCount,
      anchors_fixed: toFix.length,
      canonical_anchors_present: CANONICAL_ANCHORS.length,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});