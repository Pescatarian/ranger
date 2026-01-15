const express = require('express');
const router = express.Router();
const User = require('../models/user');
const auth = require('../middleware/auth');

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create a user
router.post('/register', async (req, res) => {
  console.log('Registration attempt with:', req.body);
  
  const user = new User({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password
  });

  try {
    const newUser = await user.save();
    console.log('User registered successfully:', newUser.email);
    res.status(201).json(newUser);
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(400).json({ msg: err.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  console.log('Login attempt with:', req.body.email);
  
  try {
    // Find user by email
    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      console.log('Login failed: User not found');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    // Check password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    
    if (!isMatch) {
      console.log('Login failed: Password does not match');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    // Create JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { user: { id: user.id } },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const response = { 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email 
      } 
    };
    
    console.log('User logged in successfully:', user.email);
    console.log('Sending response with token:', token.substring(0, 20) + '...');
    console.log('Full response object:', JSON.stringify(response));
    
    res.json(response);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;