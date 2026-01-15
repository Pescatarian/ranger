const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cellSchema = new Schema({
  id: {
    type: String,
    required: true  // e.g., "A1", "B2"
  },
  text: String,
  backgroundColor: String,
  textColor: String,
  rangeData: String,  // JSON string of range data
  hasRange: Boolean
});

const workbookSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  cells: [cellSchema],
  settings: {
    currentColors: [String],
    currentWeights: [Number],
    currentFormat: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Workbook', workbookSchema);