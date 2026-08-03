/**
 * Shared base-26 coordinate address utilities.
 * Used by assignMissingAnchors and reindexInheritedAddresses.
 */

const BASE = 26;
const OFFSET = 256;

export const ANCHOR_MAP = {
  Protect: 'A', Danger: 'B', Hope: 'C', Shadow: 'D',
  Light: 'E', Growth: 'F', Fear: 'G', Trust: 'H',
};

export function toBase26(n) {
  if (n <= 0) return '';
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % BASE)) + result;
    n = Math.floor(n / BASE);
  }
  return result;
}

export function encodeCoord(coord) {
  return toBase26(Math.round(coord) + OFFSET).padStart(2, 'A');
}

export function buildCoordinateAddress(x, y, z, anchorName) {
  const anchor = ANCHOR_MAP[anchorName] || 'Z';
  return `${anchor}.${encodeCoord(x)}.${encodeCoord(y)}.${encodeCoord(z)}`;
}

export function fromBase26(str) {
  if (!str) return 0;
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const digit = str.charCodeAt(i) - 65;
    if (digit < 0 || digit >= BASE) return -1;
    n = n * BASE + digit + 1;
  }
  return n;
}

export function decodeCoord(coordStr) {
  return fromBase26(coordStr) - OFFSET;
}

/**
 * Computes the Euclidean distance between a node's current (x, y, z)
 * coordinates and the coordinates decoded from its inherited_address.
 * Returns 0 if the address is malformed or the node is a base anchor.
 * Non-zero = the node has drifted from its assigned address.
 */
export function computeDissonance(node) {
  if (!node.inherited_address || node.tier === 'base') return 0;
  const parts = node.inherited_address.split('.');
  if (parts.length < 4) return 0;

  const decodedX = decodeCoord(parts[1]);
  const decodedY = decodeCoord(parts[2]);
  const decodedZ = decodeCoord(parts[3]);
  if (decodedX === -1 || decodedY === -1 || decodedZ === -1) return 0;

  const dx = (node.x || 0) - decodedX;
  const dy = (node.y || 0) - decodedY;
  const dz = (node.z || 0) - decodedZ;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}