require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
// Add CORS
const cors = require('cors');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Add CORS middleware before other middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Basic route
app.get('/', (req, res) => {
  res.send('Ranger App API is running');
});

// Import routes
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const rangeRoutes = require('./routes/ranges');
const workbookRoutes = require('./routes/workbooks');
const trainerSpotRoutes = require('./routes/trainerSpots');

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ranges', rangeRoutes);
app.use('/api/workbooks', workbookRoutes);
app.use('/api/trainer/spots', trainerSpotRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});