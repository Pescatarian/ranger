/**
 * Range Engine API Routes
 * Exposes range calculation endpoints
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rangeEngine = require('../services/rangeEngine');

/**
 * @route GET /api/range-engine/grid
 * @desc Get empty range grid structure
 * @access Private
 */
router.get('/grid', auth, (req, res) => {
  try {
    const grid = rangeEngine.createRangeGrid();
    const stats = rangeEngine.calculateRangeStats(grid);

    res.json({
      success: true,
      data: {
        grid,
        stats
      }
    });
  } catch (err) {
    console.error('Error creating grid:', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

/**
 * @route POST /api/range-engine/parse
 * @desc Parse range notation to grid
 * @access Private
 */
router.post('/parse', auth, (req, res) => {
  try {
    const { rangeText } = req.body;

    if (typeof rangeText !== 'string') {
      return res.status(400).json({ success: false, msg: 'rangeText must be a string' });
    }

    const grid = rangeEngine.parseRangeNotation(rangeText);
    const stats = rangeEngine.calculateRangeStats(grid);
    const notation = rangeEngine.gridToRangeNotation(grid);

    res.json({
      success: true,
      data: {
        grid,
        stats,
        notation
      }
    });
  } catch (err) {
    console.error('Error parsing range:', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

/**
 * @route POST /api/range-engine/expand
 * @desc Expand hand shorthand to all combos
 * @access Private
 */
router.post('/expand', auth, (req, res) => {
  try {
    const { hand } = req.body;

    if (!hand || typeof hand !== 'string') {
      return res.status(400).json({ success: false, msg: 'hand must be a string' });
    }

    const combos = rangeEngine.expandShorthand(hand);

    res.json({
      success: true,
      data: {
        hand,
        combos,
        count: combos.length
      }
    });
  } catch (err) {
    console.error('Error expanding hand:', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

/**
 * @route POST /api/range-engine/toggle
 * @desc Toggle cell selection in grid
 * @access Private
 */
router.post('/toggle', auth, (req, res) => {
  try {
    const { grid, handKey, selected, weight } = req.body;

    if (!grid || typeof grid !== 'object') {
      return res.status(400).json({ success: false, msg: 'grid must be an object' });
    }

    if (!handKey || typeof handKey !== 'string') {
      return res.status(400).json({ success: false, msg: 'handKey must be a string' });
    }

    const updatedGrid = rangeEngine.toggleCell(grid, handKey, selected, weight || 1);
    const stats = rangeEngine.calculateRangeStats(updatedGrid);
    const notation = rangeEngine.gridToRangeNotation(updatedGrid);

    res.json({
      success: true,
      data: {
        grid: updatedGrid,
        stats,
        notation
      }
    });
  } catch (err) {
    console.error('Error toggling cell:', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

/**
 * @route POST /api/range-engine/stats
 * @desc Calculate stats for a grid
 * @access Private
 */
router.post('/stats', auth, (req, res) => {
  try {
    const { grid } = req.body;

    if (!grid || typeof grid !== 'object') {
      return res.status(400).json({ success: false, msg: 'grid must be an object' });
    }

    const stats = rangeEngine.calculateRangeStats(grid);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (err) {
    console.error('Error calculating stats:', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

/**
 * @route POST /api/range-engine/convert
 * @desc Convert range between formats (GTOw, Flopzilla, etc)
 * @access Private
 */
router.post('/convert', auth, (req, res) => {
  try {
    const { rangeText, fromFormat, toFormat } = req.body;

    if (!rangeText || typeof rangeText !== 'string') {
      return res.status(400).json({ success: false, msg: 'rangeText must be a string' });
    }

    const converted = rangeEngine.convertRangeFormat(
      rangeText,
      fromFormat || 'standard',
      toFormat || 'standard'
    );

    res.json({
      success: true,
      data: {
        original: rangeText,
        converted,
        fromFormat: fromFormat || 'standard',
        toFormat: toFormat || 'standard'
      }
    });
  } catch (err) {
    console.error('Error converting range:', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

/**
 * @route POST /api/range-engine/notation
 * @desc Convert grid to range notation string
 * @access Private
 */
router.post('/notation', auth, (req, res) => {
  try {
    const { grid } = req.body;

    if (!grid || typeof grid !== 'object') {
      return res.status(400).json({ success: false, msg: 'grid must be an object' });
    }

    const notation = rangeEngine.gridToRangeNotation(grid);

    res.json({
      success: true,
      data: { notation }
    });
  } catch (err) {
    console.error('Error generating notation:', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
});

module.exports = router;