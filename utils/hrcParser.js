/**
 * HRC JSON Parser
 * Converts HRC exported JSON to TrainerSpot format
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

      // Convert hands to ranges per action
      const ranges = buildRanges(spot.hands, spot.actions);

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
 *  - "EP RFI" → "Unknown"
 *  - "EP vs BB 3Bet" → "BB"
 *  - "SB vs BU" → "BU"
 */
function parseVillain(spotName) {
  const vsMatch = spotName.match(/vs\s+([A-Z]{2,3})/i);
  return vsMatch ? vsMatch[1] : 'Unknown';
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
 * Build ranges array from HRC hands data
 * Converts frequencies per action into separate range objects
 * @param {Object} hands - HRC hands object
 * @param {Array} actions - HRC actions array
 * @returns {Array} ranges - Array of { condition, rangeData }
 */
function buildRanges(hands, actions) {
  const ranges = [];

  // Create a range for each action type
  for (const action of actions) {
    const actionType = action.type;
    const actionLabel = ACTION_MAP[actionType] || actionType;

    const rangeData = {};

    // Process each hand
    for (const [hand, data] of Object.entries(hands)) {
      if (!data.played || !Array.isArray(data.played)) {
        continue;
      }

      const actionIndex = actions.findIndex(a => a.type === actionType);
      if (actionIndex === -1) continue;

      const frequency = data.played[actionIndex];

      // Only include hands with non-zero frequency for this action
      if (frequency > 0) {
        rangeData[hand] = {
          weight: data.weight || 1.0,
          frequency: frequency,
          ev: data.evs && data.evs[actionIndex] !== undefined ? data.evs[actionIndex] : null
        };
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
  ACTION_MAP
};
