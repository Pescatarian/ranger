/**
 * Range Engine API Routes
 * Exposes range calculation endpoints - NO AUTH required (pure calculations)
 */

const express = require('express');
const router = express.Router();
const rangeEngine = require('../services/rangeEngine');

/**
 * @route   GET /api/range-engine/grid
 * @desc    Get empty 13x13 range grid
 * @access  Public
 */
router.get('/grid', (req, res) => {
  try {
    const grid = rangeEngine.createRangeGrid();
    res.json({ success: true, grid });
  } catch (err) {
    console.error('Error creating grid:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/range-engine/parse
 * @desc    Parse range notation string to grid
 * @access  Public
 */
router.post('/parse', (req, res) => {
  try {
    const { notation } = req.body;
    
    if (!notation) {
      return res.status(400).json({ success: false, error: 'Notation is required' });
    }
    
    const grid = rangeEngine.parseRangeNotation(notation);
    const stats = rangeEngine.calculateRangeStats(grid);
    
    res.json({ success: true, grid, stats });
  } catch (err) {
    console.error('Error parsing notation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/range-engine/expand
 * @desc    Expand hand shorthand to all combos
 * @access  Public
 */
router.post('/expand', (req, res) => {
  try {
    const { hand } = req.body;
    
    if (!hand) {
      return res.status(400).json({ success: false, error: 'Hand is required' });
    }
    
    const combos = rangeEngine.expandShorthand(hand);
    res.json({ success: true, hand, combos, count: combos.length });
  } catch (err) {
    console.error('Error expanding hand:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/range-engine/toggle
 * @desc    Toggle cell selection in grid
 * @access  Public
 */
router.post('/toggle', (req, res) => {
  try {
    const { grid, row, col, selected } = req.body;
    
    if (!grid || row === undefined || col === undefined) {
      return res.status(400).json({ success: false, error: 'Grid, row, and col are required' });
    }
    
    const updatedGrid = rangeEngine.toggleCell(grid, row, col, selected);
    const stats = rangeEngine.calculateRangeStats(updatedGrid);
    
    res.json({ success: true, grid: updatedGrid, stats });
  } catch (err) {
    console.error('Error toggling cell:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/range-engine/stats
 * @desc    Calculate range statistics
 * @access  Public
 */
router.post('/stats', (req, res) => {
  try {
    const { grid } = req.body;
    
    if (!grid) {
      return res.status(400).json({ success: false, error: 'Grid is required' });
    }
    
    const stats = rangeEngine.calculateRangeStats(grid);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error calculating stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/range-engine/convert
 * @desc    Convert range between formats (GTOw/Pio <-> Flopzilla)
 * @access  Public
 */
router.post('/convert', (req, res) => {
  try {
    const { range, from, to } = req.body;
    
    if (!range || !from || !to) {
      return res.status(400).json({ success: false, error: 'Range, from, and to formats are required' });
    }
    
    const converted = rangeEngine.convertRangeFormat(range, from, to);
    res.json({ success: true, original: range, converted, from, to });
  } catch (err) {
    console.error('Error converting range:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/range-engine/notation
 * @desc    Convert grid to range notation string
 * @access  Public
 */
router.post('/notation', (req, res) => {
  try {
    const { grid } = req.body;
    
    if (!grid) {
      return res.status(400).json({ success: false, error: 'Grid is required' });
    }
    
    const notation = rangeEngine.gridToRangeNotation(grid);
    res.json({ success: true, notation });
  } catch (err) {
    console.error('Error generating notation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
