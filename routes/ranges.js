const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Range = require('../models/range');

// @route   GET /api/ranges
// @desc    Get all ranges for the logged in user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const ranges = await Range.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(ranges);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/ranges/:id
// @desc    Get a range by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const range = await Range.findById(req.params.id);
    
    if (!range) {
      return res.status(404).json({ msg: 'Range not found' });
    }
    
    // Make sure user owns the range
    if (range.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    res.json(range);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Range not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/ranges
// @desc    Create a new range
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, rangeData, imageUrl } = req.body;
    
    const newRange = new Range({
      name,
      description,
      rangeData,
      imageUrl,
      user: req.user.id
    });
    
    const range = await newRange.save();
    res.json(range);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/ranges/:id
// @desc    Update a range
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, rangeData, imageUrl } = req.body;
    
    // Find the range
    let range = await Range.findById(req.params.id);
    
    if (!range) {
      return res.status(404).json({ msg: 'Range not found' });
    }
    
    // Make sure user owns the range
    if (range.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    // Update fields
    range.name = name || range.name;
    range.description = description || range.description;
    range.rangeData = rangeData || range.rangeData;
    range.imageUrl = imageUrl || range.imageUrl;
    range.updatedAt = Date.now();
    
    await range.save();
    res.json(range);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Range not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/ranges/:id
// @desc    Delete a range
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const range = await Range.findById(req.params.id);
    
    if (!range) {
      return res.status(404).json({ msg: 'Range not found' });
    }
    
    // Make sure user owns the range
    if (range.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    await Range.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Range removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Range not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;