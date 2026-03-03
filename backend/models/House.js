const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  rent: { type: Number, required: true },
  location: { type: String, required: true }, // Area name
  images: [{ type: String }],
  ownerName: { type: String, required: true },
  ownerPhone: { type: String, required: true }, // Restricted: Hidden until payment
  collegeId: { type: String, default: 'KLU' },
  isAvailable: { type: Boolean, default: true },
  
  // Track students who have paid the viewing fee to unlock details
  unlockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('House', houseSchema);