/**
 * HRC Import Routes
 * POST /api/trainer/import - Import HRC JSON file
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TrainerSpot = require('../models/trainerSpot');
const { parseHrcJson, validateHrcFile } = require('../utils/hrcParser');
const multer = require('multer');

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

/**
 * @route POST /api/trainer/import
 * @desc Import HRC JSON file and create trainer spots
 * @access Private
 * @body multipart/form-data with 'hrcFile' field
 */
router.post('/import', auth, upload.single('hrcFile'), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        msg: 'No file uploaded. Please attach an HRC JSON file.'
      });
    }

    // Parse JSON from buffer
    let hrcData;
    try {
      const fileContent = req.file.buffer.toString('utf8');
      hrcData = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        msg: 'Invalid JSON file. Please ensure the file is valid HRC JSON format.'
      });
    }

    // Validate HRC file structure
    try {
      validateHrcFile(req.file.buffer, hrcData);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        msg: validationError.message
      });
    }

    // Parse HRC data to TrainerSpot format
    const { spots, summary } = parseHrcJson(hrcData, req.user.id);

    if (spots.length === 0) {
      return res.status(400).json({
        success: false,
        msg: 'No valid spots found in file. Check that the file format is correct.',
        summary
      });
    }

    // Bulk insert all spots
    const insertedSpots = await TrainerSpot.insertMany(spots, { ordered: false });

    // Return success with summary
    return res.json({
      success: true,
      msg: `Successfully imported ${insertedSpots.length} trainer spots`,
      summary: {
        total: summary.total,
        imported: insertedSpots.length,
        skipped: summary.skipped,
        errors: summary.errors.slice(0, 20) // Return first 20 errors for debugging
      }
    });

  } catch (err) {
    console.error('HRC import error:', err);

    // Handle MongoDB bulk insert partial failures
    if (err.writeErrors) {
      const insertedCount = err.insertedDocs ? err.insertedDocs.length : 0;
      return res.status(207).json({ // 207 = Multi-Status
        success: true,
        partial: true,
        msg: `Partial import: ${insertedCount} spots imported, ${err.writeErrors.length} failed`,
        imported: insertedCount,
        failed: err.writeErrors.length,
        errors: err.writeErrors.slice(0, 10).map(e => e.errmsg)
      });
    }

    return res.status(500).json({
      success: false,
      msg: 'Server error during import. Please try again.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * @route POST /api/trainer/import/preview
 * @desc Preview HRC import without saving to database
 * @access Private
 * @body multipart/form-data with 'hrcFile' field
 */
router.post('/import/preview', auth, upload.single('hrcFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        msg: 'No file uploaded'
      });
    }

    // Parse JSON
    let hrcData;
    try {
      hrcData = JSON.parse(req.file.buffer.toString('utf8'));
    } catch (err) {
      return res.status(400).json({
        success: false,
        msg: 'Invalid JSON format'
      });
    }

    // Validate
    try {
      validateHrcFile(req.file.buffer, hrcData);
    } catch (err) {
      return res.status(400).json({
        success: false,
        msg: err.message
      });
    }

    // Parse without saving
    const { spots, summary } = parseHrcJson(hrcData, req.user.id);

    // Return preview data
    return res.json({
      success: true,
      summary,
      preview: spots.slice(0, 10).map(s => ({
        name: s.name,
        position: s.position,
        villain: s.villain,
        action: s.action,
        rangeCount: s.ranges.length,
        sampleRange: s.ranges ? {
          condition: s.ranges.condition,
          handCount: Object.keys(s.ranges.rangeData).length
        } : null
      }))
    });

  } catch (err) {
    console.error('HRC preview error:', err);
    return res.status(500).json({
      success: false,
      msg: 'Server error during preview',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * @route DELETE /api/trainer/spots/bulk
 * @desc Delete multiple trainer spots by IDs
 * @access Private
 * @body { spotIds: [id1, id2, ...] }
 */
router.delete('/spots/bulk', auth, async (req, res) => {
  try {
    const { spotIds } = req.body;

    if (!spotIds || !Array.isArray(spotIds) || spotIds.length === 0) {
      return res.status(400).json({
        success: false,
        msg: 'Please provide an array of spot IDs to delete'
      });
    }

    // Delete spots owned by this user
    const result = await TrainerSpot.deleteMany({
      _id: { $in: spotIds },
      user: req.user.id
    });

    return res.json({
      success: true,
      msg: `Deleted ${result.deletedCount} spots`,
      deletedCount: result.deletedCount
    });

  } catch (err) {
    console.error('Bulk delete error:', err);
    return res.status(500).json({
      success: false,
      msg: 'Server error during bulk delete'
    });
  }
});

module.exports = router;
