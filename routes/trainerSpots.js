const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TrainerSpot = require('../models/trainerSpot');

// @route   GET /api/trainer/spots
// @desc    Get all trainer spots for the logged in user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const spots = await TrainerSpot.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(spots);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/trainer/spots/:id
// @desc    Get a trainer spot by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const spot = await TrainerSpot.findById(req.params.id);
    
    if (!spot) {
      return res.status(404).json({ msg: 'Spot not found' });
    }
    
    // Make sure user owns the spot
    if (spot.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    res.json(spot);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Spot not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/trainer/spots
// @desc    Create a new trainer spot
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, position, villain, action, ranges } = req.body;
    
    const newSpot = new TrainerSpot({
      name,
      position,
      villain,
      action,
      ranges,
      user: req.user.id
    });
    
    const spot = await newSpot.save();
    res.json(spot);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/trainer/spots/:id
// @desc    Update a trainer spot
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, position, villain, action, ranges } = req.body;
    
    // Find the spot
    let spot = await TrainerSpot.findById(req.params.id);
    
    if (!spot) {
      return res.status(404).json({ msg: 'Spot not found' });
    }
    
    // Make sure user owns the spot
    if (spot.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    // Update fields
    spot.name = name || spot.name;
    spot.position = position || spot.position;
    spot.villain = villain || spot.villain;
    spot.action = action || spot.action;
    spot.ranges = ranges || spot.ranges;
    spot.updatedAt = Date.now();
    
    await spot.save();
    res.json(spot);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Spot not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/trainer/spots/:id
// @desc    Delete a trainer spot
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const spot = await TrainerSpot.findById(req.params.id);
    
    if (!spot) {
      return res.status(404).json({ msg: 'Spot not found' });
    }
    
    // Make sure user owns the spot
    if (spot.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    await TrainerSpot.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Spot removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Spot not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;