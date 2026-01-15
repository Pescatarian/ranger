const mongoose = require('mongoose');

const TrainerSpotSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  position: {
    type: String,
    required: true
  },
  villain: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  ranges: [
    {
      condition: {
        type: String,
        required: true
      },
      rangeData: {
        type: Object,
        required: true
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TrainerSpot', TrainerSpotSchema);