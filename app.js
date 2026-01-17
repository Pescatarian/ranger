require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration - Allow Vercel frontend and localhost for development
const allowedOrigins = [
  'https://ranger-app-client.vercel.app',
  'http://localhost:3000',
  'http://localhost:3002'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Still allow for now, but log it
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

app.use(express.json());

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Connect to MongoDB with production-ready options
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Basic route
app.get('/', (req, res) => {
  res.send('Ranger App API is running');
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
