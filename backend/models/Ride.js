const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  captain: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  type: { type: String, enum: ['on-spot', 'pre-booking'], required: true },
  officialRouteId: { type: String },
  route: { type: String, required: true },
  pickupLocation: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String }
  },
  dropLocation: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String }
  },
  distanceKm: { type: Number },
  etaMin: { type: Number },
  scheduledAt: { type: Date },
  searchExpiresAt: { type: Date },
  acceptedAt: { type: Date },
  arrivedAt: { type: Date },
  startedAt: { type: Date },
  paymentDueAt: { type: Date },
  autoAssigned: { type: Boolean, default: false },
  matchedRadiusKm: { type: Number },
  price: { type: Number, required: true },
  
  status: { 
    type: String, 
    enum: ['scheduled', 'searching', 'accepted', 'arrived', 'in_progress', 'paid', 'completed', 'cancelled'], 
    default: 'searching' 
  },
  
  isPaid: { type: Boolean, default: false },
  completionCode: { type: String } // The 4-digit OTP
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);