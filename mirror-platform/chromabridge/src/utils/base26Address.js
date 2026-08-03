/**
 * Base-26 Symbolic Address System — Compositional & Recursive
 * Each digit has 26 possible values: A (0) through Z (25).
 * Addresses evolve as the domain structure is recalculated.
 *
 * Format: A.B.C.D (up to 4 dot-separated base-26 digits)
 *   A = level-0 domain index (largest = A)
 *   B = level-1 sub-domain index
 *   C = level-2 sub-sub-domain index
 *   D = level-3 leaf index (node within smallest cluster)
 *
 * The hierarchy is compositional: A.B.C and A.B.F are siblings
 * within bridge A.B. Truncating the last digit moves up the hierarchy.
 * Prefix similarity equals semantic proximity.
 */

const BASE = 26;

/**
 * Convert a 1-indexed integer to a bijective base-26 string (A=1, B=2, ..., Z=26, AA=27...).
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
 * 'A' → 1, 'Z' → 26, 'AA' → 27. Returns -1 for invalid characters.
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
 * Split a compositional address into its level digits.
 * "A.BC.D" → ["A", "BC", "D"]
 */
export function parseAddress(address) {
  if (!address) return [];
  return address.split('.');
}

/**
 * Get the depth (number of levels) of an address.
 * "A" → 1, "A.B" → 2, "A.B.C.D" → 4
 */
export function getAddressDepth(address) {
  return parseAddress(address).length;
}

/**
 * Get the parent address (truncates the last digit).
 * "A.B.C.D" → "A.B.C", "A" → ""
 */
export function getParentAddress(address) {
  const parts = parseAddress(address);
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('.');
}

/**
 * Get the domain prefix (first digit) of an address.
 * "A.B.C.D" → "A"
 */
export function getDomainPrefix(address) {
  const parts = parseAddress(address);
  return parts[0] || '';
}

/**
 * Check if two addresses share a common prefix (are in the same branch).
 * Returns the number of shared leading levels, or 0 if none.
 */
export function sharedPrefixDepth(addrA, addrB) {
  const a = parseAddress(addrA);
  const b = parseAddress(addrB);
  const len = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) shared++;
    else break;
  }
  return shared;
}