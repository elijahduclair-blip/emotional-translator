const ANCHORS = [
  { name: 'White', normalizedName: 'white', addressRoot: '1', degreeOfVision: 90 },
  { name: 'Blue', normalizedName: 'blue', addressRoot: '2', degreeOfVision: 170 },
  { name: 'Black', normalizedName: 'black', addressRoot: '3', degreeOfVision: 250 },
  { name: 'Red', normalizedName: 'red', addressRoot: '4', degreeOfVision: 10 },
  { name: 'Orange', normalizedName: 'orange', addressRoot: '5', degreeOfVision: 50 },
  { name: 'Yellow', normalizedName: 'yellow', addressRoot: '6', degreeOfVision: 130 },
  { name: 'Green', normalizedName: 'green', addressRoot: '7', degreeOfVision: 210 },
  { name: 'Purple', normalizedName: 'purple', addressRoot: '8', degreeOfVision: 290 },
  { name: 'Gray', normalizedName: 'gray', addressRoot: '9', degreeOfVision: 330 }
];

export const FIXED_COLOR_ANCHORS = Object.freeze(ANCHORS.map(anchor => Object.freeze({ ...anchor })));
const ANCHOR_BY_NAME = new Map(FIXED_COLOR_ANCHORS.map(anchor => [anchor.normalizedName, anchor]));

export function normalizeFixedName(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
  return normalized === 'grey' ? 'gray' : normalized;
}

export function fixedAnchor(value) {
  return ANCHOR_BY_NAME.get(normalizeFixedName(value)) || null;
}

export function buildKnowledgePlacements(records) {
  const byName = new Map();
  for (const record of records) {
    const name = normalizeFixedName(record.name);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(record);
  }
  for (const bucket of byName.values()) bucket.sort(compareRecords);

  const anchorCoordinates = new Map();
  for (const anchor of FIXED_COLOR_ANCHORS) {
    const candidate = (byName.get(anchor.normalizedName) || [])
      .sort((left, right) => tierRank(left.tier) - tierRank(right.tier) || compareRecords(left, right))
      .find(record => validCoordinates(record.coordinates));
    if (candidate) anchorCoordinates.set(anchor.normalizedName, candidate.coordinates);
  }

  const hierarchyCache = new Map();
  const collectHierarchyAnchors = (record, visiting = new Set()) => {
    if (hierarchyCache.has(record.id)) return new Set(hierarchyCache.get(record.id));
    if (visiting.has(record.id)) return new Set();
    const nextVisiting = new Set(visiting).add(record.id);
    const anchors = new Set();
    for (const parentName of record.parents || []) {
      const parentAnchor = fixedAnchor(parentName);
      if (parentAnchor) {
        anchors.add(parentAnchor.normalizedName);
        continue;
      }
      for (const parent of byName.get(normalizeFixedName(parentName)) || []) {
        for (const inherited of collectHierarchyAnchors(parent, nextVisiting)) anchors.add(inherited);
      }
    }
    hierarchyCache.set(record.id, [...anchors]);
    return anchors;
  };

  const anchorCache = new Map();
  const resolveAnchor = record => {
    if (anchorCache.has(record.id)) return anchorCache.get(record.id);
    const direct = fixedAnchor(record.name);
    if (direct) {
      const resolved = { anchor: direct, basis: 'fixed_anchor' };
      anchorCache.set(record.id, resolved);
      return resolved;
    }
    const directParentAnchors = new Set(
      (record.parents || [])
        .map(parentName => fixedAnchor(parentName)?.normalizedName)
        .filter(Boolean)
    );
    const hierarchyAnchors = directParentAnchors.size ? directParentAnchors : collectHierarchyAnchors(record);
    if (hierarchyAnchors.size) {
      const anchor = nearestAnchor(record.coordinates, anchorCoordinates, hierarchyAnchors)
        || FIXED_COLOR_ANCHORS.find(candidate => hierarchyAnchors.has(candidate.normalizedName));
      const resolved = { anchor, basis: 'hierarchy' };
      anchorCache.set(record.id, resolved);
      return resolved;
    }
    const nearest = nearestAnchor(record.coordinates, anchorCoordinates);
    if (nearest) {
      const resolved = { anchor: nearest, basis: 'coordinate_fallback' };
      anchorCache.set(record.id, resolved);
      return resolved;
    }
    anchorCache.set(record.id, null);
    return null;
  };

  const placements = new Map();
  const nonWordGroups = new Map();
  for (const record of records) {
    const resolved = resolveAnchor(record);
    if (!resolved) continue;
    const { anchor, basis } = resolved;
    if (fixedAnchor(record.name)) {
      placements.set(record.id, placement(anchor, anchor.addressRoot, 0, 'fixed_anchor'));
      continue;
    }
    if (record.tier === 'words') continue;
    if (!nonWordGroups.has(anchor.normalizedName)) nonWordGroups.set(anchor.normalizedName, []);
    nonWordGroups.get(anchor.normalizedName).push(record);
  }

  for (const anchor of FIXED_COLOR_ANCHORS) {
    const children = (nonWordGroups.get(anchor.normalizedName) || []).sort(compareRecords);
    children.forEach((record, index) => {
      const basis = resolveAnchor(record)?.basis || 'coordinate_fallback';
      placements.set(record.id, placement(anchor, `${anchor.addressRoot}.${index + 1}`, 1, basis));
    });
  }

  const wordGroups = new Map();
  for (const record of records.filter(item => item.tier === 'words').sort(compareRecords)) {
    const resolved = resolveAnchor(record);
    if (!resolved) continue;
    const { anchor, basis } = resolved;
    const parentPlacement = firstPlacedParent(record, byName, placements);
    const parentAddress = parentPlacement?.decimalAddress || anchor.addressRoot;
    if (!wordGroups.has(parentAddress)) wordGroups.set(parentAddress, []);
    wordGroups.get(parentAddress).push({ record, anchor, parentAddress, basis: parentPlacement ? 'hierarchy' : basis });
  }

  for (const group of wordGroups.values()) {
    group.sort((left, right) => compareRecords(left.record, right.record));
    group.forEach(({ record, anchor, parentAddress, basis }, index) => {
      const depth = parentAddress.split('.').length;
      placements.set(record.id, placement(anchor, `${parentAddress}.${index + 1}`, depth, basis));
    });
  }

  return placements;
}

function firstPlacedParent(record, byName, placements) {
  for (const parentName of record.parents || []) {
    const candidates = byName.get(normalizeFixedName(parentName)) || [];
    const parent = candidates.find(candidate => candidate.tier !== 'words' && placements.has(candidate.id));
    if (parent) return placements.get(parent.id);
  }
  return null;
}

function placement(anchor, decimalAddress, addressDepth, placementBasis) {
  return {
    fixedAnchor: anchor.name,
    degreeOfVision: anchor.degreeOfVision,
    decimalAddress,
    addressDepth,
    placementBasis
  };
}

function nearestAnchor(coordinates, anchorCoordinates, allowedNames = null) {
  if (!validCoordinates(coordinates)) return null;
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of FIXED_COLOR_ANCHORS) {
    if (allowedNames && !allowedNames.has(anchor.normalizedName)) continue;
    const reference = anchorCoordinates.get(anchor.normalizedName);
    if (!reference) continue;
    const distance = (coordinates.x - reference.x) ** 2
      + (coordinates.y - reference.y) ** 2
      + (coordinates.z - reference.z) ** 2;
    if (distance < nearestDistance) {
      nearest = anchor;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function validCoordinates(value) {
  return value && [value.x, value.y, value.z].every(Number.isFinite);
}

function tierRank(tier) {
  return tier === 'base' ? 0 : tier === 'bridge' ? 1 : tier === 'shade' ? 2 : 3;
}

function compareRecords(left, right) {
  return Number(left.provenance?.page || 0) - Number(right.provenance?.page || 0)
    || Number(left.provenance?.row || 0) - Number(right.provenance?.row || 0)
    || normalizeFixedName(left.name).localeCompare(normalizeFixedName(right.name))
    || String(left.id).localeCompare(String(right.id));
}
