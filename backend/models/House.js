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
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  unlockFee: { type: Number, default: 50 },
  createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Track students who have paid the viewing fee to unlock details
  unlockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  unlockPayments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      amount: { type: Number, default: 50 },
      method: { type: String, enum: ['upi', 'card', 'netbanking', 'simulated'], default: 'simulated' },
      status: { type: String, enum: ['success', 'failed'], default: 'success' },
      paymentRef: { type: String },
      paidAt: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('House', houseSchema);