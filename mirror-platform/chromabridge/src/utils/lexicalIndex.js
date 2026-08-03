/**
 * Lexical Index — Variable-length circular coordinate path.
 *
 * Maps each letter A-Z to an angular slot on a 26-position ring.
 * A word of any length becomes a path of angles (one per letter),
 * enabling prefix-based lookup that is decoupled from the semantic graph.
 */

const SLOT_COUNT = 26;
const SLOT_ANGLE = 360 / SLOT_COUNT;

/**
 * Converts a word into a variable-length array of angular coordinates.
 * Non-alphabetic characters are stripped; case is normalized.
 * @param {string} word
 * @returns {number[]} Array of angles in degrees (0–360)
 */
export function wordToPath(word) {
  return word
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .split('')
    .map(char => {
      const index = char.charCodeAt(0) - 97; // 'a' = 0
      return Math.round(index * SLOT_ANGLE * 100) / 100;
    });
}

/**
 * Checks if a search path is a prefix of (or exactly matches) a node path.
 * Enables search-as-you-type: "gro" matches "growth", "grow", etc.
 * @param {number[]} searchPath
 * @param {number[]} nodePath
 * @returns {boolean}
 */
export function pathMatches(searchPath, nodePath) {
  if (!searchPath || searchPath.length === 0) return true;
  if (searchPath.length > (nodePath?.length || 0)) return false;
  return searchPath.every((angle, i) => Math.abs(angle - nodePath[i]) < 0.01);
}