/**
 * RangeFormatConverter - Poker range format conversion utilities
 * COPIED FROM FRONTEND: src/utils/RangeFormatConverter.js
 * Adapted for Node.js (module.exports instead of export)
 * NO LOGIC CHANGES - exact parity with frontend
 */

// Format 1 to Format 2 conversion
function convertFormat1ToFormat2(format1Text) {
  // Parse Format 1
  const handRegex = /([2-9TJQKA][cdhs][2-9TJQKA][cdhs]):(\d+\.?\d*)/g;
  const hands = {};
  let match;

  while ((match = handRegex.exec(format1Text)) !== null) {
    const [, hand, weightStr] = match;
    const weight = parseFloat(weightStr);

    // Standardize hand representation
    const card1 = hand[0] + hand[1];
    const card2 = hand[2] + hand[3];

    // Determine hand type (pair, suited, offsuit)
    let handType;
    let standardHand;

    if (card1[0] === card2[0]) {
      // Pair
      handType = 'pairs';
      standardHand = card1[0] + card2[0];
    } else {
      // Suited or offsuit
      const suit1 = card1[1];
      const suit2 = card2[1];
      const isSuited = suit1 === suit2;
      handType = isSuited ? 'suited' : 'offsuit';

      // Determine order (higher rank first)
      const ranks = '23456789TJQKA';
      const rank1 = ranks.indexOf(card1[0]);
      const rank2 = ranks.indexOf(card2[0]);

      if (rank1 >= rank2) {
        standardHand = card1[0] + card2[0] + (isSuited ? 's' : 'o');
      } else {
        standardHand = card2[0] + card1[0] + (isSuited ? 's' : 'o');
      }
    }

    // Group by weight
    if (!hands[weight]) hands[weight] = { pairs: [], suited: [], offsuit: [] };
    hands[weight][handType].push(standardHand);
  }

  // Convert to Format 2
  let format2Text = '';

  Object.keys(hands).forEach(weight => {
    const handsByWeight = hands[weight];
    const allHandsInWeight = [];

    // Process pairs
    if (handsByWeight.pairs.length > 0) {
      const pairRanges = compressRange(handsByWeight.pairs);
      allHandsInWeight.push(...pairRanges);
    }

    // Process suited
    if (handsByWeight.suited.length > 0) {
      const suitedRanges = compressRange(handsByWeight.suited);
      allHandsInWeight.push(...suitedRanges);
    }

    // Process offsuit
    if (handsByWeight.offsuit.length > 0) {
      const offsuitRanges = compressRange(handsByWeight.offsuit);
      allHandsInWeight.push(...offsuitRanges);
    }

    if (allHandsInWeight.length > 0) {
      format2Text += `[${weight}]${allHandsInWeight.join(', ')}[/${weight}]\n`;
    }
  });

  return format2Text;
}

// Format 2 to Format 1 conversion
function convertFormat2ToFormat1(format2Text) {
  const weightSectionRegex = /\[(\d+\.?\d*)\]([^[]*?)\[\/\1\]/gs;
  let format1Hands = [];
  let match;

  while ((match = weightSectionRegex.exec(format2Text)) !== null) {
    const [, weightStr, handsSection] = match;
    const weight = parseFloat(weightStr);

    // Split the hands section by commas
    const handRanges = handsSection.split(',').map(s => s.trim()).filter(s => s.length > 0);

    for (const range of handRanges) {
      const expandedHands = expandRange(range);

      for (const hand of expandedHands) {
        // Convert to specific format 1 hands
        if (hand.length === 2) {
          // Pair: Generate all 6 combinations
          const rank = hand[0];
          const suits = ['c', 'd', 'h', 's'];

          for (let i = 0; i < suits.length; i++) {
            for (let j = i + 1; j < suits.length; j++) {
              format1Hands.push(`${rank}${suits[i]}${rank}${suits[j]}:${weight}`);
            }
          }
        } else if (hand.length === 3) {
          // Suited or offsuit
          const rank1 = hand[0];
          const rank2 = hand[1];
          const type = hand[2]; // 's' or 'o'

          if (type === 's') {
            // Suited: 4 combinations (one for each suit)
            const suits = ['c', 'd', 'h', 's'];
            for (const suit of suits) {
              format1Hands.push(`${rank1}${suit}${rank2}${suit}:${weight}`);
            }
          } else {
            // Offsuit: 12 combinations
            const suits = ['c', 'd', 'h', 's'];
            for (const suit1 of suits) {
              for (const suit2 of suits) {
                if (suit1 !== suit2) {
                  format1Hands.push(`${rank1}${suit1}${rank2}${suit2}:${weight}`);
                }
              }
            }
          }
        }
      }
    }
  }

  return format1Hands.join(',');
}

// Helper function to compress individual hands into ranges
function compressRange(hands) {
  if (hands.length === 0) return [];

  // Sort hands
  const ranks = '23456789TJQKA';
  hands.sort((a, b) => {
    // For pairs (like AA, KK)
    if (a.length === 2 && b.length === 2) {
      return ranks.indexOf(b[0]) - ranks.indexOf(a[0]);
    }

    // For other hands (like AKs, QJo)
    if (a[0] !== b[0]) {
      return ranks.indexOf(b[0]) - ranks.indexOf(a[0]);
    }
    return ranks.indexOf(b[1]) - ranks.indexOf(a[1]);
  });

  const result = [];
  let rangeStart = null;
  let prevHand = null;

  for (let i = 0; i < hands.length; i++) {
    const hand = hands[i];

    // Start a new range
    if (rangeStart === null) {
      rangeStart = hand;
      prevHand = hand;
      continue;
    }

    // Check if hands are consecutive
    const isConsecutive = areConsecutive(prevHand, hand);

    if (!isConsecutive) {
      // End current range and start new one
      if (rangeStart === prevHand) {
        result.push(rangeStart);
      } else {
        result.push(`${rangeStart}-${prevHand}`);
      }
      rangeStart = hand;
    }

    prevHand = hand;
  }

  // Handle the last range
  if (rangeStart !== null) {
    if (rangeStart === prevHand) {
      result.push(rangeStart);
    } else {
      result.push(`${rangeStart}-${prevHand}`);
    }
  }

  return result;
}

// Helper function to expand ranges like "AK-AT" into individual hands
function expandRange(rangeStr) {
  const result = [];

  // Check if it's a range with a hyphen
  if (rangeStr.includes('-')) {
    const [start, end] = rangeStr.split('-').map(s => s.trim());

    // For pairs
    if (start.length === 2 && end.length === 2) {
      const ranks = '23456789TJQKA';
      const startIndex = ranks.indexOf(start[0]);
      const endIndex = ranks.indexOf(end[0]);

      for (let i = startIndex; i >= endIndex; i--) {
        result.push(ranks[i] + ranks[i]);
      }
    }
    // For suited/offsuit hands
    else if (start.length === 3 && end.length === 3) {
      const type = start[2]; // 's' or 'o'
      if (start[0] === end[0]) {
        // Same first rank, range in second rank
        const ranks = '23456789TJQKA';
        const startIndex = ranks.indexOf(start[1]);
        const endIndex = ranks.indexOf(end[1]);

        for (let i = startIndex; i >= endIndex; i--) {
          result.push(start[0] + ranks[i] + type);
        }
      }
    }
  } else {
    // Just a single hand
    result.push(rangeStr);
  }

  return result;
}

// Helper to check if hands are consecutive for range compression
function areConsecutive(hand1, hand2) {
  const ranks = '23456789TJQKA';

  // For pairs
  if (hand1.length === 2 && hand2.length === 2) {
    const index1 = ranks.indexOf(hand1[0]);
    const index2 = ranks.indexOf(hand2[0]);
    return index1 - index2 === 1;
  }

  // For suited/offsuit hands
  if (hand1.length === 3 && hand2.length === 3) {
    // Must be same type (suited or offsuit)
    if (hand1[2] !== hand2[2]) return false;

    // Same first card, consecutive second card
    if (hand1[0] === hand2[0]) {
      const index1 = ranks.indexOf(hand1[1]);
      const index2 = ranks.indexOf(hand2[1]);
      return index1 - index2 === 1;
    }
  }

  return false;
}

// Node.js exports
module.exports = {
  convertFormat1ToFormat2,
  convertFormat2ToFormat1,
  compressRange,
  expandRange,
  areConsecutive
};
