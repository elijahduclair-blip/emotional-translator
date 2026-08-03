import { BRAILLE_STANDARD_REFERENCES, NOTATION_BOUNDARY } from './braille-math.js';

export const BRAILLE_MATH_CURRICULUM = Object.freeze({
  id: 'ueb-nemeth-foundations',
  version: '1.0.0',
  title: 'Braille Mathematics Foundations',
  code: 'ueb_with_nemeth',
  level: 'arithmetic_pre_algebra',
  disclaimer: 'This course supplements formal Braille instruction and does not certify proficiency.',
  standardReferences: BRAILLE_STANDARD_REFERENCES,
  boundary: NOTATION_BOUNDARY,
  lessons: [
    lesson('cells-and-numbers', 1, 'Six-dot orientation and numbers', 'Read dot positions, the numeric indicator, and Nemeth lower-cell digits.', ['⠼⠂', '⠼⠂⠴'], [{ prompt: '12', direction: 'print_to_nemeth' }]),
    lesson('operations-comparisons', 2, 'Operations and comparisons', 'Use operation signs without spaces and comparison signs with spaces.', ['3+3', '3*4 = 12'], [{ prompt: '7-2 = 5', direction: 'print_to_nemeth' }]),
    lesson('decimals-negatives', 3, 'Decimals and negatives', 'Place a negative sign before the numeric indicator and keep decimals within the numeral.', ['-4', '4.5'], [{ prompt: '-3+5 = 2', direction: 'print_to_nemeth' }]),
    lesson('grouping', 4, 'Grouping', 'Read parentheses and brackets as structural boundaries.', ['5-(-4)', '[2+3]*4'], [{ prompt: '(2+3)*4', direction: 'print_to_nemeth' }]),
    lesson('variables', 5, 'Variables and coefficients', 'Read lowercase variables and implicit multiplication without inventing color meaning.', ['x+2', '2x = 8'], [{ prompt: '3x+2 = 11', direction: 'print_to_nemeth' }]),
    lesson('fractions', 6, 'Simple fractions', 'Use opening, line, and closing fraction indicators.', ['frac(3,4)', 'frac(a+b,c)'], [{ prompt: 'frac(2,3) < frac(3,4)', direction: 'print_to_nemeth' }]),
    lesson('exponents', 7, 'Integer exponents', 'Use the superscript indicator for non-negative integer powers.', ['x^2', '4^4 = 64'], [{ prompt: 'x^2+2x+1', direction: 'print_to_nemeth' }]),
    lesson('mixed-equations', 8, 'Mixed pre-algebra equations', 'Combine verified structures and identify notation outside the supported field of vision.', ['2(x+3) = 12', 'frac(x+1,2) >= 4'], [{ prompt: 'frac(x+1,2) = 4', direction: 'print_to_nemeth' }])
  ]
});

function lesson(id, order, title, objective, examples, exercises) {
  return { id, order, title, objective, examples, exercises, colorOverlayOptional: true, authoritativeCues: ['dot_numbers', 'unicode_braille', 'spoken_description'] };
}

