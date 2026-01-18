/**
 * Range Engine Routes - API endpoints for range format conversion
 * Uses RangeFormatConverter (exact copy from frontend)
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rangeConverter = require('../services/RangeFormatConverter');

/**
 * @route   POST /api/range-engine/convert
 * @desc    Convert range between formats
 * @access  Private (requires auth)
 * @body    { rangeText, fromFormat, toFormat }
 */
router.post('/convert', auth, (req, res) => {
  try {
    const { rangeText, fromFormat, toFormat } = req.body;

    // Validation
    if (!rangeText || typeof rangeText !== 'string') {
      return res.status(400).json({ error: 'rangeText is required and must be a string' });
    }

    if (!fromFormat || !toFormat) {
      return res.status(400).json({ error: 'fromFormat and toFormat are required' });
    }

    const validFormats = ['format1', 'format2'];
    if (!validFormats.includes(fromFormat) || !validFormats.includes(toFormat)) {
      return res.status(400).json({ 
        error: `Invalid format. Valid formats are: ${validFormats.join(', ')}` 
      });
    }

    if (fromFormat === toFormat) {
      return res.json({ 
        success: true,
        converted: rangeText,
        message: 'Same format, no conversion needed'
      });
    }

    // Perform conversion
    let converted;
    if (fromFormat === 'format1' && toFormat === 'format2') {
      converted = rangeConverter.convertFormat1ToFormat2(rangeText);
    } else if (fromFormat === 'format2' && toFormat === 'format1') {
      converted = rangeConverter.convertFormat2ToFormat1(rangeText);
    }

    res.json({
      success: true,
      converted,
      fromFormat,
      toFormat
    });

  } catch (error) {
    console.error('Range conversion error:', error);
    res.status(500).json({ 
      error: 'Conversion failed', 
      details: error.message 
    });
  }
});

/**
 * @route   GET /api/range-engine/health
 * @desc    Health check for range engine
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'range-engine',
    version: '1.0.0'
  });
});

module.exports = router;
