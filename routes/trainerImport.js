/**
 * HRC Import Route
 * Handles importing HRC JSON files to TrainerSpots
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TrainerSpot = require('../models/trainerSpot');
const { parseHrcJson, validateHrcFile } = require('../utils/hrcParser');

/**
 * @route   POST /api/trainer/import
 * @desc    Import HRC JSON file
 * @access  Private
 * @body    { hrcData: Object } - Parsed HRC JSON
 */
router.post('/import', auth, async (req, res) => {
  try {
    const { hrcData } = req.body;

    if (!hrcData) {
      return res.status(400).json({ 
        success: false,
        msg: 'Missing hrcData in request body' 
      });
    }

    // Validate file structure (size check happens on frontend)
    try {
      validateHrcFile(Buffer.from(JSON.stringify(hrcData)), hrcData);
    } catch (validationError) {
      return res.status(400).json({ 
        success: false,
        msg: validationError.message 
      });
    }

    // Parse HRC data
    const { spots, summary } = parseHrcJson(hrcData, req.user.id);

    if (spots.length === 0) {
      return res.status(400).json({ 
        success: false,
        msg: 'No valid spots found in file',
        summary 
      });
    }

    // Bulk insert spots
    const insertedSpots = await TrainerSpot.insertMany(spots, { ordered: false });

    return res.json({
      success: true,
      msg: `Successfully imported ${insertedSpots.length} spots`,
      summary: {
        ...summary,
        inserted: insertedSpots.length
      }
    });

  } catch (err) {
    console.error('HRC import error:', err);
    
    // Handle bulk insert partial failures
    if (err.writeErrors) {
      const insertedCount = err.insertedDocs ? err.insertedDocs.length : 0;
      return res.status(207).json({
        success: false,
        msg: `Partial import: ${insertedCount} spots imported, ${err.writeErrors.length} failed`,
        errors: err.writeErrors.map(e => e.errmsg)
      });
    }

    return res.status(500).json({ 
      success: false,
      msg: 'Server error during import',
      error: err.message
    });
  }
});

/**
 * @route   POST /api/trainer/import/preview
 * @desc    Preview HRC import without saving
 * @access  Private
 * @body    { hrcData: Object } - Parsed HRC JSON
 */
router.post('/import/preview', auth, async (req, res) => {
  try {
    const { hrcData } = req.body;

    if (!hrcData) {
      return res.status(400).json({ 
        success: false,
        msg: 'Missing hrcData in request body' 
      });
    }

    // Validate
    try {
      validateHrcFile(Buffer.from(JSON.stringify(hrcData)), hrcData);
    } catch (validationError) {
      return res.status(400).json({ 
        success: false,
        msg: validationError.message 
      });
    }

    // Parse without saving
    const { spots, summary } = parseHrcJson(hrcData, req.user.id);

    // Return preview with first 10 spots
    return res.json({
      success: true,
      summary,
      preview: spots.slice(0, 10).map(s => ({
        name: s.name,
        position: s.position,
        villain: s.villain,
        action: s.action,
        rangeCount: s.ranges.length
      }))
    });

  } catch (err) {
    console.error('HRC preview error:', err);
    return res.status(500).json({ 
      success: false,
      msg: 'Server error during preview',
      error: err.message
    });
  }
});

/**
 * @route   DELETE /api/trainer/spots/all
 * @desc    Delete all trainer spots for user (use with caution)
 * @access  Private
 */
router.delete('/spots/all', auth, async (req, res) => {
  try {
    const result = await TrainerSpot.deleteMany({ user: req.user.id });
    
    return res.json({
      success: true,
      msg: `Deleted ${result.deletedCount} spots`
    });
  } catch (err) {
    console.error('Delete all spots error:', err);
    return res.status(500).json({ 
      success: false,
      msg: 'Server error' 
    });
  }
});

module.exports = router;
