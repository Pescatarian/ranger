/**
 * HRC JSON Parser
 * Converts HRC exported JSON to TrainerSpot format
 * Maps HRC frequencies to RangeBuilder grid format
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

// Color mapping for actions (matches RangeBuilder defaults)
const ACTION_COLORS = {
  'Fold': '#FF0000',    // Red
  'Raise': '#4CAF50',   // Green
  'Call': '#2196F3',    // Blue
  '3-Bet': '#9C27B0',   // Purple
  '4-Bet': '#FF9800',   // Orange
  '5-Bet': '#F44336',   // Deep Red
  'Check': '#00BCD4',   // Cyan
  'All-in': '#FFC107'   // Amber
};

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

      // Parse context from spot name
      const { villain, action } = parseSpotContext(spotName, spot.position);

      // Convert hands to ranges per action (RangeBuilder format)
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
 * Parse villain and action from spot name
 * Examples:
 *  - "EP RFI" → { villain: "None", action: "RFI" }
 *  - "BB vs CO Open" → { villain: "CO", action: "Defend" }
 *  - "SB vs BU 3Bet" → { villain: "BU", action: "vs 3Bet" }
 */
function parseSpotContext(spotName, position) {
  let villain = 'None';
  let action = 'RFI';

  // Extract villain if "vs X" pattern exists
  const vsMatch = spotName.match(/vs\s+([A-Z]{2,3})/i);
  if (vsMatch) {
    villain = vsMatch[1];
  }

  // Extract action context
  if (spotName.includes('RFI')) {
    action = 'RFI';
  } else if (spotName.includes('3Bet')) {
    action = vsMatch ? 'vs 3Bet' : '3Bet';
  } else if (spotName.includes('4Bet')) {
    action = vsMatch ? 'vs 4Bet' : '4Bet';
  } else if (spotName.includes('5Bet')) {
    action = vsMatch ? 'vs 5Bet' : '5Bet';
  } else if (spotName.includes('Open')) {
    action = vsMatch ? 'vs Open' : 'Open';
  } else if (spotName.includes('Call')) {
    action = 'Call';
  } else if (spotName.includes('Defend')) {
    action = 'Defend';
  }

  return { villain, action };
}

/**
 * Build ranges in RangeBuilder grid format
 * Converts HRC frequencies → Map-based grid with colors
 * @param {Object} hands - HRC hands object
 * @param {Array} actions - HRC actions array
 * @returns {Array} ranges - Array of { condition, rangeData }
 */
function buildRangesForRangeBuilder(hands, actions) {
  const ranges = [];

  // Create a range for each action type
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
    const action = actions[actionIndex];
    const actionType = action.type;
    const actionLabel = ACTION_MAP[actionType] || actionType;
    const color = ACTION_COLORS[actionLabel] || '#808080';

    const rangeData = {};

    // Process each hand
    for (const [handNotation, handData] of Object.entries(hands)) {
      if (!handData.played || !Array.isArray(handData.played)) {
        continue;
      }

      const frequency = handData.played[actionIndex];

      // Only include hands with non-zero frequency for this action
      if (frequency > 0) {
        // Convert HRC notation (e.g., "AKs") to grid cells
        const gridCells = convertHandToGridCells(handNotation);

        for (const cellKey of gridCells) {
          rangeData[cellKey] = {
            weight: Math.round(frequency * 100), // Convert 0.83 → 83%
            color: color,
            ev: handData.evs && handData.evs[actionIndex] !== undefined 
              ? handData.evs[actionIndex] 
              : null
          };
        }
      }
    }

    // Only add range if it has hands
    if (Object.keys(rangeData).length > 0) {
      ranges.push({
        condition: actionLabel,
        rangeData: rangeData
      });
    }
  }

  return ranges;
}

/**
 * Convert HRC hand notation to RangeBuilder grid cell keys
 * Examples:
 *  - "AA" → ["AA"]
 *  - "AKs" → ["AKs"]
 *  - "AKo" → ["AKo"]
 *  - "22" → ["22"]
 */
function convertHandToGridCells(handNotation) {
  // HRC uses standard poker notation, which matches RangeBuilder
  // Just return as-is since the grid uses the same keys
  return [handNotation];
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
  ACTION_COLORS
};
