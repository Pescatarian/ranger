/**
 * Range Engine - Core poker range calculation logic
 * This module contains all business logic for hand ranges
 * PROTECTED - runs server-side only
 */

// Constants
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['h', 'd', 'c', 's'];
const TOTAL_COMBOS = 1326;

/**
 * Creates an empty 13x13 range grid
 * @returns {Array} 13x13 grid with hand info
 */
function createRangeGrid() {
  const grid = [];

  for (let i = 0; i < 13; i++) {
    const row = [];
    for (let j = 0; j < 13; j++) {
      const rank1 = RANKS[i];
      const rank2 = RANKS[j];

      let hand, type, combos;

      if (i === j) {
        // Pocket pair
        hand = rank1 + rank2;
        type = 'pair';
        combos = 6;
      } else if (i < j) {
        // Suited (above diagonal)
        hand = rank1 + rank2 + 's';
        type = 'suited';
        combos = 4;
      } else {
        // Offsuit (below diagonal)
        hand = rank2 + rank1 + 'o';
        type = 'offsuit';
        combos = 12;
      }

      row.push({
        hand,
        type,
        combos,
        selected: false,
        weight: 0
      });
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Expands a hand shorthand to all specific combos
 * e.g., "AK" -> ["AhKs", "AhKc", "AhKd", "AsKh", ...]
 * @param {string} hand - Hand in shorthand notation (e.g., "AK", "AKs", "AA")
 * @returns {Array} Array of specific hand combos
 */
function expandShorthand(hand) {
  const combos = [];

  if (!hand || hand.length < 2) {
    return combos;
  }

  const rank1 = hand[0].toUpperCase();
  const rank2 = hand[1].toUpperCase();
  const modifier = hand.length > 2 ? hand[2].toLowerCase() : null;

  // Validate ranks
  if (!RANKS.includes(rank1) || !RANKS.includes(rank2)) {
    return combos;
  }

  if (rank1 === rank2) {
    // Pocket pair - 6 combos
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        combos.push(rank1 + SUITS[i] + rank2 + SUITS[j]);
      }
    }
  } else if (modifier === 's') {
    // Suited - 4 combos
    for (const suit of SUITS) {
      combos.push(rank1 + suit + rank2 + suit);
    }
  } else if (modifier === 'o') {
    // Offsuit - 12 combos
    for (const suit1 of SUITS) {
      for (const suit2 of SUITS) {
        if (suit1 !== suit2) {
          combos.push(rank1 + suit1 + rank2 + suit2);
        }
      }
    }
  } else {
    // No modifier - all 16 combos (4 suited + 12 offsuit)
    for (const suit1 of SUITS) {
      for (const suit2 of SUITS) {
        combos.push(rank1 + suit1 + rank2 + suit2);
      }
    }
  }

  return combos;
}

/**
 * Parses range notation string and returns a grid with selections
 * @param {string} notation - Range notation (e.g., "AA,KK,QQ,AKs,AKo")
 * @returns {Array} Grid with selected hands marked
 */
function parseRangeNotation(notation) {
  const grid = createRangeGrid();

  if (!notation || notation.trim() === '') {
    return grid;
  }

  const hands = notation.split(',').map(h => h.trim().toUpperCase());

  for (const hand of hands) {
    if (!hand) continue;

    // Handle range notation like "AK+" or "77+"
    if (hand.includes('+')) {
      const baseHand = hand.replace('+', '');
      const expandedHands = expandRangePlus(baseHand);
      for (const eh of expandedHands) {
        markHandInGrid(grid, eh);
      }
    } else if (hand.includes('-')) {
      // Handle range notation like "AK-AT" or "77-22"
      const expandedHands = expandRangeDash(hand);
      for (const eh of expandedHands) {
        markHandInGrid(grid, eh);
      }
    } else {
      markHandInGrid(grid, hand);
    }
  }

  return grid;
}

/**
 * Marks a hand as selected in the grid
 * @param {Array} grid - The range grid
 * @param {string} hand - Hand to mark (e.g., "AKs", "AA")
 */
function markHandInGrid(grid, hand) {
  if (!hand || hand.length < 2) return;

  const rank1 = hand[0].toUpperCase();
  const rank2 = hand[1].toUpperCase();
  const modifier = hand.length > 2 ? hand[2].toLowerCase() : null;

  const i = RANKS.indexOf(rank1);
  const j = RANKS.indexOf(rank2);

  if (i === -1 || j === -1) return;

  if (i === j) {
    // Pocket pair
    grid[i][j].selected = true;
    grid[i][j].weight = 1;
  } else if (modifier === 's') {
    // Suited - above diagonal (smaller index first)
    const row = Math.min(i, j);
    const col = Math.max(i, j);
    grid[row][col].selected = true;
    grid[row][col].weight = 1;
  } else if (modifier === 'o') {
    // Offsuit - below diagonal (larger index first)
    const row = Math.max(i, j);
    const col = Math.min(i, j);
    grid[row][col].selected = true;
    grid[row][col].weight = 1;
  } else {
    // No modifier - select both suited and offsuit
    const row1 = Math.min(i, j);
    const col1 = Math.max(i, j);
    const row2 = Math.max(i, j);
    const col2 = Math.min(i, j);
    grid[row1][col1].selected = true;
    grid[row1][col1].weight = 1;
    grid[row2][col2].selected = true;
    grid[row2][col2].weight = 1;
  }
}

/**
 * Expands "+" notation (e.g., "AK+" -> ["AK", "AQ", "AJ", ...])
 * @param {string} hand - Base hand
 * @returns {Array} Expanded hands
 */
function expandRangePlus(hand) {
  const expanded = [];
  const rank1 = hand[0].toUpperCase();
  const rank2 = hand[1].toUpperCase();
  const modifier = hand.length > 2 ? hand[2].toLowerCase() : '';

  const idx1 = RANKS.indexOf(rank1);
  const idx2 = RANKS.indexOf(rank2);

  if (idx1 === idx2) {
    // Pocket pairs: "77+" means 77, 88, 99, TT, JJ, QQ, KK, AA
    for (let i = idx1; i >= 0; i--) {
      expanded.push(RANKS[i] + RANKS[i]);
    }
  } else {
    // Broadway hands: "AK+" or "AKs+"
    const higherRank = RANKS[Math.min(idx1, idx2)];
    const startIdx = Math.max(idx1, idx2);

    for (let i = startIdx; i > Math.min(idx1, idx2); i--) {
      expanded.push(higherRank + RANKS[i] + modifier);
    }
  }

  return expanded;
}

/**
 * Expands "-" notation (e.g., "AK-AT" -> ["AK", "AQ", "AJ", "AT"])
 * @param {string} range - Range string
 * @returns {Array} Expanded hands
 */
function expandRangeDash(range) {
  const expanded = [];
  const [start, end] = range.split('-');

  if (!start || !end) return expanded;

  const rank1Start = start[0].toUpperCase();
  const rank2Start = start[1].toUpperCase();
  const rank1End = end[0].toUpperCase();
  const rank2End = end[1].toUpperCase();
  const modifier = start.length > 2 ? start[2].toLowerCase() : '';

  const idx1 = RANKS.indexOf(rank1Start);
  const idx2Start = RANKS.indexOf(rank2Start);
  const idx2End = RANKS.indexOf(rank2End);

  if (rank1Start === rank2Start && rank1End === rank2End) {
    // Pair range: "77-22"
    const startPair = RANKS.indexOf(rank1Start);
    const endPair = RANKS.indexOf(rank1End);
    for (let i = Math.min(startPair, endPair); i <= Math.max(startPair, endPair); i++) {
      expanded.push(RANKS[i] + RANKS[i]);
    }
  } else {
    // Non-pair range: "AK-AT"
    for (let i = Math.min(idx2Start, idx2End); i <= Math.max(idx2Start, idx2End); i++) {
      if (i !== idx1) {
        expanded.push(rank1Start + RANKS[i] + modifier);
      }
    }
  }

  return expanded;
}

/**
 * Toggles a cell's selection state
 * @param {Array} grid - Current grid
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {boolean} selected - New selection state (optional, toggles if not provided)
 * @returns {Array} Updated grid
 */
function toggleCell(grid, row, col, selected = null) {
  const newGrid = JSON.parse(JSON.stringify(grid)); // Deep clone

  if (row >= 0 && row < 13 && col >= 0 && col < 13) {
    if (selected !== null) {
      newGrid[row][col].selected = selected;
      newGrid[row][col].weight = selected ? 1 : 0;
    } else {
      newGrid[row][col].selected = !newGrid[row][col].selected;
      newGrid[row][col].weight = newGrid[row][col].selected ? 1 : 0;
    }
  }

  return newGrid;
}

/**
 * Calculates range statistics
 * @param {Array} grid - The range grid
 * @returns {Object} Statistics object
 */
function calculateRangeStats(grid) {
  let selectedCombos = 0;
  let selectedHands = 0;
  let totalWeight = 0;

  const breakdown = {
    pairs: { selected: 0, total: 0, combos: 0 },
    suited: { selected: 0, total: 0, combos: 0 },
    offsuit: { selected: 0, total: 0, combos: 0 }
  };

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const cell = grid[i][j];

      if (cell.type === 'pair') {
        breakdown.pairs.total++;
        if (cell.selected) {
          breakdown.pairs.selected++;
          breakdown.pairs.combos += cell.combos * (cell.weight || 1);
        }
      } else if (cell.type === 'suited') {
        breakdown.suited.total++;
        if (cell.selected) {
          breakdown.suited.selected++;
          breakdown.suited.combos += cell.combos * (cell.weight || 1);
        }
      } else {
        breakdown.offsuit.total++;
        if (cell.selected) {
          breakdown.offsuit.selected++;
          breakdown.offsuit.combos += cell.combos * (cell.weight || 1);
        }
      }

      if (cell.selected) {
        selectedHands++;
        selectedCombos += cell.combos * (cell.weight || 1);
        totalWeight += cell.weight || 1;
      }
    }
  }

  const percentage = ((selectedCombos / TOTAL_COMBOS) * 100).toFixed(1);

  return {
    selectedHands,
    selectedCombos: Math.round(selectedCombos),
    totalCombos: TOTAL_COMBOS,
    percentage: parseFloat(percentage),
    breakdown
  };
}

/**
 * Converts grid to range notation string
 * @param {Array} grid - The range grid
 * @returns {string} Range notation
 */
function gridToRangeNotation(grid) {
  const hands = [];

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      if (grid[i][j].selected) {
        hands.push(grid[i][j].hand);
      }
    }
  }

  return hands.join(',');
}

/**
 * Converts GTOw/Pio format to Flopzilla format
 * GTOw: AhKh, AsKs (suit-specific)
 * Flopzilla: AKs, AKo (suited/offsuit)
 * @param {string} range - Range in GTOw format
 * @returns {string} Range in Flopzilla format
 */
function gtowToFlopzilla(range) {
  // DIAGNOSTIC LOGGING
  console.log('[gtowToFlopzilla] Input:', range);
  
  if (!range || range.trim() === '') {
    console.log('[gtowToFlopzilla] Empty input, returning empty string');
    return '';
  }

  const hands = range.split(',').map(h => h.trim());
  console.log('[gtowToFlopzilla] Split hands:', hands);
  
  const handMap = new Map(); // Track unique hands

  for (const hand of hands) {
    console.log('[gtowToFlopzilla] Processing hand:', hand, 'length:', hand.length);
    
    if (hand.length < 4) {
      // Already in short format, pass through
      console.log('[gtowToFlopzilla] Short format, passing through:', hand);
      handMap.set(hand, true);
      continue;
    }

    // Parse GTOw format: AhKs (4 chars)
    const rank1 = hand[0].toUpperCase();
    const suit1 = hand[1].toLowerCase();
    const rank2 = hand[2].toUpperCase();
    const suit2 = hand[3].toLowerCase();
    
    console.log('[gtowToFlopzilla] Parsed:', { rank1, suit1, rank2, suit2 });

    if (!RANKS.includes(rank1) || !RANKS.includes(rank2)) {
      console.log('[gtowToFlopzilla] Invalid ranks, skipping');
      continue;
    }

    // Determine if suited or offsuit
    if (rank1 === rank2) {
      // Pocket pair
      const result = rank1 + rank2;
      console.log('[gtowToFlopzilla] Pocket pair:', result);
      handMap.set(result, true);
    } else if (suit1 === suit2) {
      // Suited
      const idx1 = RANKS.indexOf(rank1);
      const idx2 = RANKS.indexOf(rank2);
      const highRank = idx1 < idx2 ? rank1 : rank2;
      const lowRank = idx1 < idx2 ? rank2 : rank1;
      const result = highRank + lowRank + 's';
      console.log('[gtowToFlopzilla] Suited:', result);
      handMap.set(result, true);
    } else {
      // Offsuit
      const idx1 = RANKS.indexOf(rank1);
      const idx2 = RANKS.indexOf(rank2);
      const highRank = idx1 < idx2 ? rank1 : rank2;
      const lowRank = idx1 < idx2 ? rank2 : rank1;
      const result = highRank + lowRank + 'o';
      console.log('[gtowToFlopzilla] Offsuit:', result);
      handMap.set(result, true);
    }
  }

  const output = Array.from(handMap.keys()).join(',');
  console.log('[gtowToFlopzilla] Final output:', output);
  return output;
}

/**
 * Converts Flopzilla format to GTOw/Pio format
 * Flopzilla: AKs, AKo (suited/offsuit)
 * GTOw: AhKh, AsKs, ... (all specific combos)
 * @param {string} range - Range in Flopzilla format
 * @returns {string} Range in GTOw format
 */
function flopzillaToGtow(range) {
  // DIAGNOSTIC LOGGING
  console.log('[flopzillaToGtow] Input:', range);
  
  if (!range || range.trim() === '') {
    console.log('[flopzillaToGtow] Empty input, returning empty string');
    return '';
  }

  const hands = range.split(',').map(h => h.trim());
  console.log('[flopzillaToGtow] Split hands:', hands);
  
  const allCombos = [];

  for (const hand of hands) {
    console.log('[flopzillaToGtow] Expanding hand:', hand);
    const combos = expandShorthand(hand);
    console.log('[flopzillaToGtow] Expanded to:', combos.length, 'combos');
    allCombos.push(...combos);
  }

  const output = allCombos.join(',');
  console.log('[flopzillaToGtow] Final output length:', output.length);
  return output;
}

/**
 * Converts range between formats
 * @param {string} range - Input range
 * @param {string} from - Source format ('gtow' or 'flopzilla')
 * @param {string} to - Target format ('gtow' or 'flopzilla')
 * @returns {string} Converted range
 */
function convertRangeFormat(range, from, to) {
  // DIAGNOSTIC LOGGING
  console.log('[convertRangeFormat] Called with:');
  console.log('  range:', range);
  console.log('  from:', from);
  console.log('  to:', to);
  
  if (!range || range.trim() === '') {
    console.log('[convertRangeFormat] Empty range, returning empty string');
    return '';
  }
  
  if (from === to) {
    console.log('[convertRangeFormat] Same format, returning input');
    return range;
  }

  let result;
  if (from === 'gtow' && to === 'flopzilla') {
    console.log('[convertRangeFormat] Converting gtow -> flopzilla');
    result = gtowToFlopzilla(range);
  } else if (from === 'flopzilla' && to === 'gtow') {
    console.log('[convertRangeFormat] Converting flopzilla -> gtow');
    result = flopzillaToGtow(range);
  } else {
    console.log('[convertRangeFormat] Unknown format combination, returning input');
    result = range;
  }
  
  console.log('[convertRangeFormat] Final result:', result);
  return result;
}

// Export all functions
module.exports = {
  RANKS,
  SUITS,
  TOTAL_COMBOS,
  createRangeGrid,
  expandShorthand,
  parseRangeNotation,
  markHandInGrid,
  expandRangePlus,
  expandRangeDash,
  toggleCell,
  calculateRangeStats,
  gridToRangeNotation,
  gtowToFlopzilla,
  flopzillaToGtow,
  convertRangeFormat
};
