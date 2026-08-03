/**
 * ChromaBridge Hex → Coordinate System
 *
 * Derives 3D semantic coordinates from an RGB hex code:
 *   X (Cool–Warm):   R − B  →  blue is cool (-255), red is warm (+255)
 *   Y (Luminance):   average of R,G,B  →  black (0) to white (255)
 *   Z (Muted–Vivid): saturation  →  gray (-255) to pure (+255)
 *
 * Coordinates are floating-point for maximum placement accuracy.
 * The semantic code is a secondary directional index (see below).
 */

export function hexToRgb(hex) {
  let h = (hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return { r: 128, g: 128, b: 128 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function hexToCoords(hex) {
  const { r, g, b } = hexToRgb(hex);
  const x = r - b;
  const y = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const z = max - min;
  return { x, y, z };
}

/**
 * Quantizes a float value into a single byte (0-255) given its axis range.
 */
function quantizeToByte(value, min, max) {
  const clamped = Math.max(min, Math.min(max, value));
  const normalized = (clamped - min) / (max - min);
  return Math.round(normalized * 255);
}

/**
 * Semantic Code — Directional Bearing (Secondary Index)
 *
 * A 6-character hex code that acts as a compass heading, telling you
 * which region of semantic space a node occupies. It is derived from
 * float coordinates by quantizing each axis into 256 directional steps:
 *
 *   Bytes 1-2 (X): 00 = deepest cool/abstract  →  FF = deepest warm/concrete
 *   Bytes 3-4 (Y): 00 = most general            →  FF = most specific
 *   Bytes 5-6 (Z): 00 = most passive/muted       →  FF = most active/vivid
 *
 * Because it is quantized, two nodes with close-but-different float
 * positions may share the same bearing — making it a stable index for
 * grouping and directional comparison rather than an exact address.
 */
export function semanticCode(x, y, z) {
  const bx = quantizeToByte(x, -255, 255);
  const by = quantizeToByte(y, 0, 255);
  const bz = quantizeToByte(z, -255, 255);
  return [bx, by, bz]
    .map(v => v.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

/**
 * Returns a human-readable compass direction for a node's position.
 * Each axis gets a directional label based on its heading.
 */
export function directionLabel(x, y, z) {
  const xDir = x > 20 ? 'Warm' : x < -20 ? 'Cool' : 'Neutral';
  const yDir = y > 170 ? 'Specific' : y < 85 ? 'General' : 'Balanced';
  const zDir = z > 20 ? 'Active' : z < -20 ? 'Passive' : 'Steady';
  return [xDir, yDir, zDir];
}

/**
 * Returns the 0–15 value of the hex character occupying `position` (1-indexed)
 * within a node's 6-char semantic code.
 */
export function slotCharValue(x, y, z, position) {
  const code = semanticCode(x, y, z);
  return parseInt(code[position - 1], 16);
}

/**
 * Position-indexed mode: when a hex slot (1–6) is active, every node's X is
 * replaced by a discrete column derived from the character (0–F) occupying
 * that position in its semantic code. Y and Z are preserved so nodes still
 * spread by luminance and saturation within their column.
 */
export function applySlot(nodes, hexSlot, bound = 255) {
  if (!hexSlot) return nodes;
  return nodes.map(n => {
    const v = slotCharValue(n.x, n.y, n.z, hexSlot);
    const slotX = -bound + (v / 15) * (2 * bound);
    return { ...n, x: slotX };
  });
}