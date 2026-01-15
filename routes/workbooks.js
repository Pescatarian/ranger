const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Workbook = require('../models/workbook');

// @route   GET /api/workbooks
// @desc    Get all workbooks for the logged in user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const workbooks = await Workbook.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(workbooks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/workbooks/:id
// @desc    Get a workbook by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const workbook = await Workbook.findById(req.params.id);
    
    if (!workbook) {
      return res.status(404).json({ msg: 'Workbook not found' });
    }
    
    // Make sure user owns the workbook
    if (workbook.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    res.json(workbook);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Workbook not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/workbooks
// @desc    Create a new workbook
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, cells, settings } = req.body;
    
    const newWorkbook = new Workbook({
      name,
      description,
      cells: cells || [],
      settings: settings || {
        currentColors: ['#4CAF50', '#FF0000'],
        currentWeights: [100, 100],
        currentFormat: 1
      },
      user: req.user.id
    });
    
    const workbook = await newWorkbook.save();
    res.json(workbook);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/workbooks/:id
// @desc    Update a workbook
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, cells, settings } = req.body;
    
    // Find the workbook
    let workbook = await Workbook.findById(req.params.id);
    
    if (!workbook) {
      return res.status(404).json({ msg: 'Workbook not found' });
    }
    
    // Make sure user owns the workbook
    if (workbook.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    // Update fields
    if (name) workbook.name = name;
    if (description) workbook.description = description;
    if (cells) workbook.cells = cells;
    if (settings) workbook.settings = settings;
    workbook.updatedAt = Date.now();
    
    await workbook.save();
    res.json(workbook);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Workbook not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/workbooks/:id
// @desc    Delete a workbook
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const workbook = await Workbook.findById(req.params.id);
    
    if (!workbook) {
      return res.status(404).json({ msg: 'Workbook not found' });
    }
    
    // Make sure user owns the workbook
    if (workbook.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    await Workbook.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Workbook removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Workbook not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/workbooks/:id/cells
// @desc    Update cells in a workbook
// @access  Private
router.put('/:id/cells', auth, async (req, res) => {
  try {
    const { cells } = req.body;
    
    // Find the workbook
    let workbook = await Workbook.findById(req.params.id);
    
    if (!workbook) {
      return res.status(404).json({ msg: 'Workbook not found' });
    }
    
    // Make sure user owns the workbook
    if (workbook.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    // Update cells
    workbook.cells = cells;
    workbook.updatedAt = Date.now();
    
    await workbook.save();
    res.json(workbook);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;