/**
 * HRC JSON Parser
 * Converts HRC exported JSON to TrainerSpot format
 * Generates grid data compatible with RangeBuilder's cellData Map structure
 */

const ACTION_MAP = {
  'F': 'Fold',
  'R': 'Raise',
  'C': 'Call',
  'X': 'Check',
  'A': 'All-in',
  '3B': '3-Bet',
  '4B': '4-Bet',
  '5B': '5-Bet'
};

// RangeBuilder grid structure: 13x13 grid for all 169 poker hands
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

/**
 * Parse HRC JSON file and convert to TrainerSpot array
 * @param {Object} hrcData - Parsed HRC JSON
 * @param {String} userId - User ID for ownership
 * @returns {Object} { spots: Array, summary: Object }
 */
function parseHrcJson(hrcData, userId) {
  const results = {
    spots: [],
    summary: {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: []
    }
  };

  // Validate top-level structure
  if (!hrcData.metadata || hrcData.metadata.format !== '6max') {
    throw new Error('Invalid HRC format: metadata.format must be "6max"');
  }

  if (!hrcData.spots || typeof hrcData.spots !== 'object') {
    throw new Error('Invalid HRC format: missing spots object');
  }

  const spotNames = Object.keys(hrcData.spots);
  results.summary.total = spotNames.length;

  // Process each spot
  for (const spotName of spotNames) {
    const spot = hrcData.spots[spotName];

    try {
      // Validate required fields
      if (!spot.position) {
        results.summary.skipped++;
        results.summary.errors.push(`Spot "${spotName}": missing position`);
        continue;
      }

      if (!spot.hands || typeof spot.hands !== 'object') {
        results.summary.skipped++;
        results.summary.errors.push(`Spot "${spotName}": missing hands object`);
        continue;
      }

      if (!spot.actions || !Array.isArray(spot.actions)) {
        results.summary.skipped++;
        results.summary.errors.push(`Spot "${spotName}": missing actions array`);
        continue;
      }

      // Parse villain from spot name
      const villain = parseVillain(spotName);

      // Determine primary action context
      const action = parseAction(spotName);

      // Convert hands to ranges per action (RangeBuilder grid format)
      const ranges = buildRangesForRangeBuilder(spot.hands, spot.actions);

      if (ranges.length === 0) {
        results.summary.skipped++;
        results.summary.errors.push(`Spot "${spotName}": no valid ranges generated`);
        continue;
      }

      // Create TrainerSpot document
      const trainerSpot = {
        user: userId,
        name: spot.spot_name || spotName,
        position: spot.position,
        villain: villain,
        action: action,
        ranges: ranges
      };

      results.spots.push(trainerSpot);
      results.summary.imported++;

    } catch (err) {
      results.summary.skipped++;
      results.summary.errors.push(`Spot "${spotName}": ${err.message}`);
    }
  }

  return results;
}

/**
 * Parse villain position from spot name
 * Examples:
 *  - "EP RFI" → "Unopened"
 *  - "EP vs BB 3Bet" → "BB"
 *  - "SB vs BU" → "BU"
 */
function parseVillain(spotName) {
  const vsMatch = spotName.match(/vs\s+([A-Z]{2,3})/i);
  if (vsMatch) {
    return vsMatch[1];
  }
  
  // RFI spots have no villain
  if (spotName.includes('RFI')) {
    return 'Unopened';
  }
  
  return 'Unknown';
}

/**
 * Parse primary action from spot name
 * Examples:
 *  - "EP RFI" → "RFI"
 *  - "CO vs BB 3Bet" → "3Bet"
 *  - "BU 4Bet" → "4Bet"
 */
function parseAction(spotName) {
  const actionMatch = spotName.match(/(RFI|3Bet|4Bet|5Bet|Call|Raise|Fold|Check|All-in)/i);
  return actionMatch ? actionMatch[1] : 'RFI';
}

/**
 * Build ranges array compatible with RangeBuilder's grid structure
 * Creates grid data matching cellData Map format used in TrainingMode.js
 * @param {Object} hands - HRC hands object
 * @param {Array} actions - HRC actions array
 * @returns {Array} ranges - Array of { condition, rangeData }
 */
function buildRangesForRangeBuilder(hands, actions) {
  const ranges = [];

  // Create a range for each action type
  for (const action of actions) {
    const actionType = action.type;
    const actionLabel = ACTION_MAP[actionType] || actionType;

    // Grid data: Map-like object with [row,col] keys
    const gridData = {};

    // Process each hand from HRC
    for (const [handStr, handData] of Object.entries(hands)) {
      if (!handData.frequencies || !handData.frequencies[actionType]) {
        continue;
      }

      const frequency = handData.frequencies[actionType];
      
      // Skip hands with 0% frequency
      if (frequency === 0) continue;

      // Convert hand string to grid coordinates
      const gridCoords = handToGridCoords(handStr);
      if (!gridCoords) continue;

      const { row, col, isPair, isSuited } = gridCoords;
      const key = `${row},${col}`;

      // Store in grid format matching RangeBuilder
      gridData[key] = {
        weight: Math.round(frequency * 100), // Convert 0.0-1.0 to 0-100
        isPair: isPair,
        isSuited: isSuited,
        ev: handData.evs && handData.evs[actions.indexOf(action)] !== undefined 
          ? handData.evs[actions.indexOf(action)] 
          : null
      };
    }

    // Only add range if it has hands
    if (Object.keys(gridData).length > 0) {
      ranges.push({
        condition: actionLabel,
        rangeData: gridData
      });
    }
  }

  return ranges;
}

/**
 * Convert poker hand notation to RangeBuilder grid coordinates
 * Grid layout (13x13):
 *   - Diagonal = pairs (AA at [0,0], 22 at [12,12])
 *   - Upper right = suited hands
 *   - Lower left = offsuit hands
 * 
 * @param {String} handStr - Hand notation (e.g., "AKs", "22", "T9o")
 * @returns {Object|null} { row, col, isPair, isSuited }
 */
function handToGridCoords(handStr) {
  // Normalize hand string
  handStr = handStr.toUpperCase().trim();

  let rank1, rank2, suited = false, pair = false;

  if (handStr.length === 2) {
    // Pair: "AA", "KK", "22"
    rank1 = handStr[0];
    rank2 = handStr[1];
    if (rank1 !== rank2) return null; // Invalid pair
    pair = true;
  } else if (handStr.length === 3) {
    // Suited/Offsuit: "AKs", "T9o"
    rank1 = handStr[0];
    rank2 = handStr[1];
    const suitIndicator = handStr[2];
    suited = (suitIndicator === 'S');
  } else {
    return null; // Invalid format
  }

  const row = RANKS.indexOf(rank1);
  const col = RANKS.indexOf(rank2);

  if (row === -1 || col === -1) return null;

  // For RangeBuilder grid:
  // - Pairs on diagonal
  // - Suited hands: higher rank on row, lower rank on col (upper right triangle)
  // - Offsuit hands: reverse (lower left triangle)
  
  if (pair) {
    return { row, col: row, isPair: true, isSuited: false };
  } else if (suited) {
    // Suited: ensure row < col (upper triangle)
    if (row > col) {
      return { row: col, col: row, isPair: false, isSuited: true };
    }
    return { row, col, isPair: false, isSuited: true };
  } else {
    // Offsuit: ensure row > col (lower triangle)
    if (row < col) {
      return { row: col, col: row, isPair: false, isSuited: false };
    }
    return { row, col, isPair: false, isSuited: false };
  }
}

/**
 * Validate HRC file constraints
 * @param {Buffer} fileBuffer - File buffer
 * @param {Object} hrcData - Parsed JSON
 * @throws {Error} if validation fails
 */
function validateHrcFile(fileBuffer, hrcData) {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_SPOTS = 5000;

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error('File too large: maximum 10MB');
  }

  if (!hrcData.metadata || hrcData.metadata.format !== '6max') {
    throw new Error('Invalid format: metadata.format must be "6max"');
  }

  if (!hrcData.spots) {
    throw new Error('Invalid format: missing spots object');
  }

  const spotCount = Object.keys(hrcData.spots).length;
  if (spotCount > MAX_SPOTS) {
    throw new Error(`Too many spots: maximum ${MAX_SPOTS}, found ${spotCount}`);
  }
}

module.exports = {
  parseHrcJson,
  validateHrcFile,
  ACTION_MAP,
  handToGridCoords // Export for testing
};
