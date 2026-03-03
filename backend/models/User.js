const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    // This regex ensures only @klu.ac.in emails are accepted at the database level
    match: [/@klu\.ac\.in$/, 'Please use a valid KLU official email address'] 
  },
  password: { 
    type: String, 
    required: true 
  },
  roles: { 
    type: [String], 
    enum: ['student', 'admin', 'rider'], 
    default: ['student'] 
  },
  // Wallet for simulated payouts (Item sales / Ride earnings)
  walletBalance: { 
    type: Number, 
    default: 0 
  },
  cryptoWalletAddress: { type: String, default: "" } ,
  createdAt: {
    type: Date,
    default: Date.now
  },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
});

module.exports = mongoose.model('User', userSchema);