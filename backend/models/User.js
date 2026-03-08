const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    match: [/@klu\.ac\.in$/, 'Please use a valid KLU official email address']
  },

  password: { 
    type: String, 
    required: true 
  },

  phone: {
    type: String,
    default: ''
  },

  /* =========================
     EMAIL VERIFICATION
  ========================= */

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailOTP: {
    type: String,
    default: null
  },

  emailOTPExpires: {
    type: Date,
    default: null
  },

  /* =========================
     USER ROLES
  ========================= */

  roles: { 
    type: [String], 
    enum: ['student', 'admin', 'rider'], 
    default: ['student'] 
  },

  /* =========================
     RIDER STATUS
  ========================= */

  riderStatus: {
    isOnline: { type: Boolean, default: false },
    lastLocation: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date }
    }
  },

  /* =========================
     WALLET
  ========================= */

  walletBalance: { 
    type: Number, 
    default: 0 
  },

  cryptoWalletAddress: { 
    type: String, 
    default: "" 
  },

  /* =========================
     USER DATA
  ========================= */

  wishlist: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Item' }
  ],

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model('User', userSchema);