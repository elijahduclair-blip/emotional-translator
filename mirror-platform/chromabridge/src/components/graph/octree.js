/**
 * Octree spatial index for O(log N) proximity queries.
 *
 * Supports:
 *   - build(nodes):          construct the tree from node array
 *   - radiusSearch(point, r): all nodes within distance r of a point
 *   - nearestNeighbors(pt, k): k closest nodes to a point
 *
 * Bounds auto-expand to fit all data at build time.
 */

const MAX_POINTS_PER_LEAF = 8;
const MAX_DEPTH = 12;

function makeNode(cx, cy, cz, half, depth) {
  return {
    cx, cy, cz, half, depth,
    points: null,
    children: null,
  };
}

function octantContaining(point, node) {
  return (point.x >= node.cx ? 4 : 0)
       | (point.y >= node.cy ? 2 : 0)
       | (point.z >= node.cz ? 1 : 0);
}

function childCenter(parent, octant) {
  const q = parent.half / 2;
  return [
    parent.cx + (octant & 4 ? q : -q),
    parent.cy + (octant & 2 ? q : -q),
    parent.cz + (octant & 1 ? q : -q),
  ];
}

function insert(point, node) {
  if (node.children) {
    const o = octantContaining(point, node);
    const [cx, cy, cz] = childCenter(node, o);
    if (!node.children[o]) node.children[o] = makeNode(cx, cy, cz, node.half / 2, node.depth + 1);
    insert(point, node.children[o]);
    return;
  }
  if (!node.points) node.points = [];
  node.points.push(point);
  if (node.points.length > MAX_POINTS_PER_LEAF && node.depth < MAX_DEPTH) {
    node.children = new Array(8).fill(null);
    const old = node.points;
    node.points = null;
    for (const p of old) {
      const o = octantContaining(p, node);
      const [cx, cy, cz] = childCenter(node, o);
      if (!node.children[o]) node.children[o] = makeNode(cx, cy, cz, node.half / 2, node.depth + 1);
      insert(p, node.children[o]);
    }
  }
}

function distSqToBox(point, node) {
  const dx = Math.max(Math.abs(point.x - node.cx) - node.half, 0);
  const dy = Math.max(Math.abs(point.y - node.cy) - node.half, 0);
  const dz = Math.max(Math.abs(point.z - node.cz) - node.half, 0);
  return dx * dx + dy * dy + dz * dz;
}

function radiusSearchRecursive(point, rSq, node, results) {
  if (distSqToBox(point, node) > rSq) return;
  if (node.children) {
    for (const child of node.children) {
      if (child) radiusSearchRecursive(point, rSq, child, results);
    }
    return;
  }
  if (node.points) {
    for (const p of node.points) {
      const dx = p.x - point.x, dy = p.y - point.y, dz = p.z - point.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq <= rSq) results.push({ node: p, distanceSq: dSq });
    }
  }
}

export default class Octree {
  constructor() {
    this.root = null;
    this._size = 0;
  }

  get size() { return this._size; }

  build(nodes) {
    this.root = null;
    this._size = 0;
    if (!nodes || nodes.length === 0) return;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
      if (n.z < minZ) minZ = n.z; if (n.z > maxZ) maxZ = n.z;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    let half = Math.max(maxX - cx, maxY - cy, maxZ - cz) + 1;
    if (half < 1) half = 1;

    this.root = makeNode(cx, cy, cz, half, 0);
    for (const n of nodes) {
      insert(n, this.root);
      this._size++;
    }
  }

  /** Returns [{ node, distanceSq }] for all nodes within radius r of a point. */
  radiusSearch(point, r) {
    const results = [];
    if (!this.root) return results;
    radiusSearchRecursive(point, r * r, this.root, results);
    return results;
  }

  /** Returns the k nearest nodes to a point as [{ node, distanceSq }], sorted ascending. */
  nearestNeighbors(point, k) {
    if (!this.root) return [];
    const all = [];
    const stack = [this.root];
    while (stack.length) {
      const node = stack.pop();
      if (node.children) {
        for (const child of node.children) if (child) stack.push(child);
      } else if (node.points) {
        for (const p of node.points) {
          const dx = p.x - point.x, dy = p.y - point.y, dz = p.z - point.z;
          all.push({ node: p, distanceSq: dx * dx + dy * dy + dz * dz });
        }
      }
    }
    all.sort((a, b) => a.distanceSq - b.distanceSq);
    return all.slice(0, k);
  }
}