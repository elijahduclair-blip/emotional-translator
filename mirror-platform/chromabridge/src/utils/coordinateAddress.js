/**
 * Pure Base-26 Coordinate Address System
 *
 * Encodes a node's (x, y, z) position + anchor family into a single
 * compositional base-26 string. Every coordinate is shifted by OFFSET so
 * the signed range [-255, 255] becomes the positive range [1, 511],
 * which maps cleanly to bijective base-26 (A = 1, ... TH = 511).
 *
 * Address format (dot-separated, compositional):
 *   <Anchor>.<XX>.<YY>.<ZZ>[.<branch>...]
 *
 *   Anchor  – single base-26 digit identifying the parent anchor family
 *   XX      – 2-char padded base-26 encoding of (x + 256)
 *   YY      – 2-char padded base-26 encoding of (y + 256)
 *   ZZ      – 2-char padded base-26 encoding of (z + 256)
 *   branch  – optional recursive sub-index digits for deeper hierarchy
 *
 * Example:  P.EX.BK.AQ   (Protect anchor, x=-125, y=5, z=-240)
 */

const BASE = 26;
const OFFSET = 256;

/**
 * Convert a 1-indexed integer to a bijective base-26 string.
 * 1 → 'A', 26 → 'Z', 27 → 'AA', 703 → 'AAA'
 */
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

/**
 * Convert a bijective base-26 string back to a 1-indexed integer.
 */
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

/**
 * Encode a single coordinate (signed) into a 2-char padded base-26 block.
 * Applies the +OFFSET so all values are positive before encoding.
 */
export function encodeCoord(coord) {
  const shifted = Math.round(coord) + OFFSET;
  const encoded = toBase26(shifted);
  return encoded.padStart(2, 'A');
}

/**
 * Decode a 2-char base-26 block back into the original signed coordinate.
 */
export function decodeCoord(block) {
  const val = fromBase26(block);
  return val - OFFSET;
}

/**
 * Map a known anchor name to its single base-26 family letter.
 */
const ANCHOR_MAP = {
  Protect: 'A',
  Danger: 'B',
  Hope: 'C',
  Shadow: 'D',
  Light: 'E',
  Growth: 'F',
  Fear: 'G',
  Trust: 'H',
};

/**
 * Build a full 26-structure coordinate address from a node's coordinates
 * and its parent anchor name.
 *
 * @param {number} x - Abstract↔Concrete (-255..255)
 * @param {number} y - General↔Specific (-255..255 or 0..255)
 * @param {number} z - Passive↔Active (-255..255)
 * @param {string} anchorName - Name of the parent base anchor
 * @param {number} [branchIndex] - Optional 1-indexed position within the cell
 * @returns {string} e.g. "A.EX.BK.AQ" or "A.EX.BK.AQ.3"
 */
export function buildCoordinateAddress(x, y, z, anchorName, branchIndex) {
  const anchor = ANCHOR_MAP[anchorName] || 'Z';
  const xx = encodeCoord(x);
  const yy = encodeCoord(y);
  const zz = encodeCoord(z);
  const base = `${anchor}.${xx}.${yy}.${zz}`;
  if (branchIndex && branchIndex > 0) {
    return `${base}.${toBase26(branchIndex)}`;
  }
  return base;
}

/**
 * Parse a coordinate address back into its components.
 * "A.EX.BK.AQ.3" → { anchor: 'A', x: -125, y: 5, z: -240, branch: 3 }
 */
export function parseCoordinateAddress(address) {
  if (!address) return null;
  const parts = address.split('.');
  if (parts.length < 4) return null;
  return {
    anchor: parts[0],
    x: decodeCoord(parts[1]),
    y: decodeCoord(parts[2]),
    z: decodeCoord(parts[3]),
    branch: parts.length > 4 ? fromBase26(parts[4]) : undefined,
  };
}

/**
 * Get the parent address (truncates the last component).
 */
export function getParentCoordinateAddress(address) {
  if (!address) return '';
  const idx = address.lastIndexOf('.');
  return idx === -1 ? '' : address.substring(0, idx);
}

/**
 * Check if two addresses share a common spatial prefix.
 * Returns the number of shared leading components.
 */
export function sharedCoordinateDepth(addrA, addrB) {
  if (!addrA || !addrB) return 0;
  const a = addrA.split('.');
  const b = addrB.split('.');
  const len = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) shared++;
    else break;
  }
  return shared;
}