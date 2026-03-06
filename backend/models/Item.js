const mongoose = require('mongoose');

// Define the Question Schema separately or inline
const questionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  question: String,
  answer: String,
  createdAt: { type: Date, default: Date.now }
});

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  condition: String,
  images: [String],
  sellerPhone: { type: String, default: "Not Provided" },
  views: { type: Number, default: 0 },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'hold', 'sold', 'pending_handover'], default: 'pending' },
  suggestedPrice: Number,
  moderation: {
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedByEmail: { type: String },
    reviewedAt: { type: Date },
    note: { type: String, maxlength: 240 }
  },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verificationCode: String,
  isPaid: { type: Boolean, default: false },
  transactionHash: { type: String },

  // --- THIS IS THE CRITICAL MISSING PIECE ---
  questions: [questionSchema] 
  // -----------------------------------------
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);