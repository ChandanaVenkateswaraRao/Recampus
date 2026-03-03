const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  captain: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  type: { type: String, enum: ['on-spot', 'pre-booking'], required: true },
  route: { type: String, required: true },
  price: { type: Number, required: true },
  
  status: { 
    type: String, 
    enum: ['searching', 'accepted', 'paid', 'completed', 'cancelled'], 
    default: 'searching' 
  },
  
  isPaid: { type: Boolean, default: false },
  completionCode: { type: String } // The 4-digit OTP
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);