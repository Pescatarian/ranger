/**
 * Range Engine - Core poker range calculation logic
 * CONFIDENTIAL - This runs server-side only
 * 
 * @module services/rangeEngine
 */

// Constants
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['h', 'd', 'c', 's'];
const TOTAL_COMBOS = 1326;

/**
 * Creates an empty 13x13 range grid with all hand combinations
 * @returns {Object} Grid object with hand data
 */
function createRangeGrid() {
  const grid = {};
  
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = 0; j < RANKS.length; j++) {
      const rank1 = RANKS[i];
      const rank2 = RANKS[j];
      let handKey;
      let handType;
      let numCombos;
      
      if (i === j) {
        // Pocket pair (diagonal)
        handKey = rank1 + rank2;
        handType = 'pair';
        numCombos = 6;
      } else if (i < j) {
        // Suited hand (above diagonal)
        handKey = rank1 + rank2 + 's';
        handType = 'suited';
        numCombos = 4;
      } else {
        // Offsuit hand (below diagonal)
        handKey = rank2 + rank1 + 'o';
        handType = 'offsuit';
        numCombos = 12;
      }
      
      grid[handKey] = {
        key: handKey,
        rank1: i < j ? rank1 : rank2,
        rank2: i < j ? rank2 : rank1,
        type: handType,
        combos: numCombos,
        selected: false,
        weight: 0,
        row: i,
        col: j
      };
    }
  }
  
  return grid;
}

/**
 * Expands a hand shorthand to all specific combos
 * @param {string} hand - Hand notation like "AK", "AKs", "AKo", "AA"
 * @returns {string[]} Array of specific combos like ["AhKs", "AhKc", ...]
 */
function expandShorthand(hand) {
  const combos = [];
  
  // Parse hand notation
  let rank1, rank2, suited = null;
  
  if (hand.length === 2) {
    // Pocket pair like "AA" or ambiguous like "AK"
    rank1 = hand[0];
    rank2 = hand[1];
  } else if (hand.length === 3) {
    // Suited/offsuit like "AKs" or "AKo"
    rank1 = hand[0];
    rank2 = hand[1];
    suited = hand[2] === 's';
  } else {
    return combos; // Invalid format
  }
  
  if (rank1 === rank2) {
    // Pocket pair - 6 combos
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        combos.push(rank1 + SUITS[i] + rank2 + SUITS[j]);
      }
    }
  } else if (suited === true) {
    // Suited - 4 combos
    for (const suit of SUITS) {
      combos.push(rank1 + suit + rank2 + suit);
    }
  } else if (suited === false) {
    // Offsuit - 12 combos
    for (const suit1 of SUITS) {
      for (const suit2 of SUITS) {
        if (suit1 !== suit2) {
          combos.push(rank1 + suit1 + rank2 + suit2);
        }
      }
    }
  } else {
    // Ambiguous (no s/o) - return all 16 combos
    for (const suit1 of SUITS) {
      for (const suit2 of SUITS) {
        if (rank1 === rank2 && suit1 >= suit2) continue; // Skip duplicate pairs
        combos.push(rank1 + suit1 + rank2 + suit2);
      }
    }
  }
  
  return combos;
}

/**
 * Calculates range statistics
 * @param {Object} grid - Range grid object
 * @returns {Object} Stats including percentage, combo count
 */
function calculateRangeStats(grid) {
  let selectedCombos = 0;
  let selectedHands = 0;
  let weightedCombos = 0;
  
  for (const hand of Object.values(grid)) {
    if (hand.selected) {
      selectedHands++;
      const weight = hand.weight || 1;
      weightedCombos += hand.combos * weight;
      selectedCombos += hand.combos;
    }
  }
  
  return {
    selectedHands,
    selectedCombos,
    weightedCombos: Math.round(weightedCombos * 100) / 100,
    totalHands: 169,
    totalCombos: TOTAL_COMBOS,
    percentage: Math.round((weightedCombos / TOTAL_COMBOS) * 1000) / 10,
    handsPercentage: Math.round((selectedHands / 169) * 1000) / 10
  };
}

/**
 * Parses range notation string to grid selection
 * @param {string} rangeText - Range notation like "AA,KK,QQ,AKs,AKo"
 * @param {Object} grid - Existing grid to update (optional)
 * @returns {Object} Updated grid with selections
 */
function parseRangeNotation(rangeText, grid = null) {
  if (!grid) {
    grid = createRangeGrid();
  }
  
  // Reset all selections
  for (const hand of Object.values(grid)) {
    hand.selected = false;
    hand.weight = 0;
  }
  
  if (!rangeText || rangeText.trim() === '') {
    return grid;
  }
  
  // Split by comma and process each hand
  const hands = rangeText.split(',').map(h => h.trim()).filter(h => h);
  
  for (let hand of hands) {
    // Handle weight notation like "AKs:0.5"
    let weight = 1;
    if (hand.includes(':')) {
      const parts = hand.split(':');
      hand = parts[0];
      weight = parseFloat(parts[1]) || 1;
    }
    
    // Handle range notation like "TT-77" or "ATs-A6s"
    if (hand.includes('-')) {
      const expandedHands = expandRangeNotation(hand);
      for (const h of expandedHands) {
        if (grid[h]) {
          grid[h].selected = true;
          grid[h].weight = weight;
        }
      }
    } else {
      // Handle plus notation like "JJ+"
      if (hand.endsWith('+')) {
        const baseHand = hand.slice(0, -1);
        const expandedHands = expandPlusNotation(baseHand);
        for (const h of expandedHands) {
          if (grid[h]) {
            grid[h].selected = true;
            grid[h].weight = weight;
          }
        }
      } else {
        // Single hand
        const normalizedHand = normalizeHandNotation(hand);
        if (grid[normalizedHand]) {
          grid[normalizedHand].selected = true;
          grid[normalizedHand].weight = weight;
        }
      }
    }
  }
  
  return grid;
}

/**
 * Expands range notation like "TT-77" or "ATs-A6s"
 * @param {string} range - Range notation
 * @returns {string[]} Array of hand notations
 */
function expandRangeNotation(range) {
  const hands = [];
  const parts = range.split('-');
  
  if (parts.length !== 2) return hands;
  
  const start = parts[0].trim();
  const end = parts[1].trim();
  
  // Determine if it's pairs or broadway
  const startRank1 = start[0];
  const startRank2 = start[1];
  const endRank1 = end[0];
  const endRank2 = end[1];
  
  const startIdx1 = RANKS.indexOf(startRank1);
  const startIdx2 = RANKS.indexOf(startRank2);
  const endIdx1 = RANKS.indexOf(endRank1);
  const endIdx2 = RANKS.indexOf(endRank2);
  
  // Pocket pairs like "TT-77"
  if (startRank1 === startRank2 && endRank1 === endRank2) {
    const highIdx = Math.min(startIdx1, endIdx1);
    const lowIdx = Math.max(startIdx1, endIdx1);
    
    for (let i = highIdx; i <= lowIdx; i++) {
      hands.push(RANKS[i] + RANKS[i]);
    }
  }
  // Broadway hands like "ATs-A6s"
  else if (startRank1 === endRank1) {
    const suited = start.endsWith('s') ? 's' : (start.endsWith('o') ? 'o' : '');
    const highIdx = Math.min(startIdx2, endIdx2);
    const lowIdx = Math.max(startIdx2, endIdx2);
    
    for (let i = highIdx; i <= lowIdx; i++) {
      hands.push(startRank1 + RANKS[i] + suited);
    }
  }
  
  return hands;
}

/**
 * Expands plus notation like "JJ+" or "ATs+"
 * @param {string} hand - Base hand notation
 * @returns {string[]} Array of hand notations
 */
function expandPlusNotation(hand) {
  const hands = [];
  const rank1 = hand[0];
  const rank2 = hand[1];
  const suited = hand.length > 2 ? hand[2] : '';
  
  const idx1 = RANKS.indexOf(rank1);
  const idx2 = RANKS.indexOf(rank2);
  
  // Pocket pairs like "JJ+"
  if (rank1 === rank2) {
    for (let i = 0; i <= idx1; i++) {
      hands.push(RANKS[i] + RANKS[i]);
    }
  }
  // Broadway like "ATs+" means ATs, AJs, AQs, AKs
  else {
    for (let i = idx1 + 1; i <= idx2; i++) {
      hands.push(rank1 + RANKS[i] + suited);
    }
  }
  
  return hands;
}

/**
 * Normalizes hand notation to standard format
 * @param {string} hand - Hand notation
 * @returns {string} Normalized notation
 */
function normalizeHandNotation(hand) {
  if (!hand || hand.length < 2) return hand;
  
  const rank1 = hand[0].toUpperCase();
  const rank2 = hand[1].toUpperCase();
  const suffix = hand.length > 2 ? hand[2].toLowerCase() : '';
  
  const idx1 = RANKS.indexOf(rank1);
  const idx2 = RANKS.indexOf(rank2);
  
  // Pocket pair
  if (rank1 === rank2) {
    return rank1 + rank2;
  }
  
  // Ensure higher rank comes first
  if (idx1 < idx2) {
    return rank1 + rank2 + suffix;
  } else {
    return rank2 + rank1 + suffix;
  }
}

/**
 * Converts grid selection to range notation string
 * @param {Object} grid - Range grid object
 * @returns {string} Range notation like "AA,KK,QQ,AKs"
 */
function gridToRangeNotation(grid) {
  const selectedHands = [];
  
  for (const hand of Object.values(grid)) {
    if (hand.selected) {
      if (hand.weight && hand.weight !== 1) {
        selectedHands.push(`${hand.key}:${hand.weight}`);
      } else {
        selectedHands.push(hand.key);
      }
    }
  }
  
  // Sort by strength (pairs first, then suited, then offsuit)
  selectedHands.sort((a, b) => {
    const handA = a.split(':')[0];
    const handB = b.split(':')[0];
    
    const rankA = RANKS.indexOf(handA[0]) * 13 + RANKS.indexOf(handA[1]);
    const rankB = RANKS.indexOf(handB[0]) * 13 + RANKS.indexOf(handB[1]);
    
    return rankA - rankB;
  });
  
  return selectedHands.join(',');
}

/**
 * Toggle a cell selection in the grid
 * @param {Object} grid - Range grid object
 * @param {string} handKey - Hand key to toggle
 * @param {boolean} selected - New selection state
 * @param {number} weight - Weight value (0-1)
 * @returns {Object} Updated grid
 */
function toggleCell(grid, handKey, selected, weight = 1) {
  if (grid[handKey]) {
    grid[handKey].selected = selected;
    grid[handKey].weight = weight;
  }
  return grid;
}

/**
 * Converts range between different formats
 * @param {string} rangeText - Input range text
 * @param {string} fromFormat - Source format ('gtow', 'flopzilla', 'standard')
 * @param {string} toFormat - Target format
 * @returns {string} Converted range text
 */
function convertRangeFormat(rangeText, fromFormat, toFormat) {
  // First parse to grid (normalized internal format)
  const grid = parseRangeNotation(rangeText);
  
  // Then export to target format
  if (toFormat === 'flopzilla') {
    return gridToFlopzillaFormat(grid);
  } else if (toFormat === 'gtow' || toFormat === 'pio') {
    return gridToGTOwFormat(grid);
  }
  
  return gridToRangeNotation(grid);
}

/**
 * Converts grid to Flopzilla format
 * @param {Object} grid - Range grid
 * @returns {string} Flopzilla format string
 */
function gridToFlopzillaFormat(grid) {
  // Flopzilla uses different notation
  const hands = [];
  
  for (const hand of Object.values(grid)) {
    if (hand.selected) {
      // Flopzilla uses lowercase 's' and 'o'
      hands.push(hand.key);
    }
  }
  
  return hands.join(', ');
}

/**
 * Converts grid to GTOw/Pio format
 * @param {Object} grid - Range grid
 * @returns {string} GTOw format string
 */
function gridToGTOwFormat(grid) {
  const hands = [];
  
  for (const hand of Object.values(grid)) {
    if (hand.selected) {
      if (hand.weight && hand.weight !== 1) {
        hands.push(`${hand.key}:${hand.weight}`);
      } else {
        hands.push(hand.key);
      }
    }
  }
  
  return hands.join(',');
}

module.exports = {
  // Constants
  RANKS,
  SUITS,
  TOTAL_COMBOS,
  
  // Core functions
  createRangeGrid,
  expandShorthand,
  calculateRangeStats,
  parseRangeNotation,
  gridToRangeNotation,
  toggleCell,
  
  // Helper functions
  expandRangeNotation,
  expandPlusNotation,
  normalizeHandNotation,
  
  // Format conversion
  convertRangeFormat,
  gridToFlopzillaFormat,
  gridToGTOwFormat
};
