/**
 * Trainer Spots API Routes
 * Handles trainer spot CRUD operations
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TrainerSpot = require('../models/trainerSpot');

/**
 * @route   GET /api/trainer/spots
 * @desc    Get all trainer spots for user
 * @access  Private
 */
router.get('/spots', auth, async (req, res) => {
  try {
    const spots = await TrainerSpot.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(spots);
  } catch (err) {
    console.error('Error fetching trainer spots:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   GET /api/trainer/spots/:id
 * @desc    Get single trainer spot
 * @access  Private
 */
router.get('/spots/:id', auth, async (req, res) => {
  try {
    const spot = await TrainerSpot.findOne({ _id: req.params.id, user: req.user.id });
    
    if (!spot) {
      return res.status(404).json({ msg: 'Trainer spot not found' });
    }
    
    res.json(spot);
  } catch (err) {
    console.error('Error fetching trainer spot:', err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Trainer spot not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   POST /api/trainer/spots
 * @desc    Create trainer spot
 * @access  Private
 */
router.post('/spots', auth, async (req, res) => {
  try {
    const { name, description, position, villain, ranges, board, notes } = req.body;
    
    const newSpot = new TrainerSpot({
      user: req.user.id,
      name: name || 'Untitled Spot',
      description,
      position,
      villain,
      ranges: ranges || [],
      board,
      notes
    });
    
    const spot = await newSpot.save();
    res.json(spot);
  } catch (err) {
    console.error('Error creating trainer spot:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   PUT /api/trainer/spots/:id
 * @desc    Update trainer spot
 * @access  Private
 */
router.put('/spots/:id', auth, async (req, res) => {
  try {
    const { name, description, position, villain, ranges, board, notes } = req.body;
    
    let spot = await TrainerSpot.findOne({ _id: req.params.id, user: req.user.id });
    
    if (!spot) {
      return res.status(404).json({ msg: 'Trainer spot not found' });
    }
    
    // Update fields
    if (name !== undefined) spot.name = name;
    if (description !== undefined) spot.description = description;
    if (position !== undefined) spot.position = position;
    if (villain !== undefined) spot.villain = villain;
    if (ranges !== undefined) spot.ranges = ranges;
    if (board !== undefined) spot.board = board;
    if (notes !== undefined) spot.notes = notes;
    spot.updatedAt = Date.now();
    
    await spot.save();
    res.json(spot);
  } catch (err) {
    console.error('Error updating trainer spot:', err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Trainer spot not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   DELETE /api/trainer/spots/:id
 * @desc    Delete trainer spot
 * @access  Private
 */
router.delete('/spots/:id', auth, async (req, res) => {
  try {
    const spot = await TrainerSpot.findOne({ _id: req.params.id, user: req.user.id });
    
    if (!spot) {
      return res.status(404).json({ msg: 'Trainer spot not found' });
    }
    
    await spot.deleteOne();
    res.json({ msg: 'Trainer spot deleted' });
  } catch (err) {
    console.error('Error deleting trainer spot:', err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Trainer spot not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
