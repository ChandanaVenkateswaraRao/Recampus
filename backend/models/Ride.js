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
  settlement: {
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminEscrowAmount: { type: Number, default: 0 },
    platformFeeAmount: { type: Number, default: 0 },
    captainPayoutAmount: { type: Number, default: 0 },
    adminEscrowCreditedAt: { type: Date },
    captainPaidAt: { type: Date }
  },
  settlementAdjustments: [
    {
      type: {
        type: String,
        enum: [
          'refund_passenger_full',
          'refund_passenger_partial',
          'release_captain_full',
          'release_captain_partial'
        ]
      },
      amount: { type: Number, default: 0 },
      note: { type: String, maxlength: 240 },
      byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      byEmail: { type: String },
      at: { type: Date, default: Date.now }
    }
  ],
  dispute: {
    status: {
      type: String,
      enum: ['none', 'open', 'in_review', 'resolved', 'rejected'],
      default: 'none'
    },
    reason: { type: String, maxlength: 240 },
    evidenceText: { type: String, maxlength: 500 },
    openedByRole: { type: String, enum: ['passenger', 'captain'] },
    openedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    openedAt: { type: Date },
    resolution: {
      type: { type: String },
      amount: { type: Number, default: 0 },
      note: { type: String, maxlength: 240 },
      resolvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      resolvedByEmail: { type: String },
      resolvedAt: { type: Date }
    }
  },
  cancelledAt: { type: Date },
  cancelledBy: { type: String, enum: ['passenger', 'captain', 'system'] },
  cancellationReason: { type: String, maxlength: 180 },
  autoAssigned: { type: Boolean, default: false },
  matchedRadiusKm: { type: Number },
  price: { type: Number, required: true },
  
  status: { 
    type: String, 
    enum: ['scheduled', 'searching', 'accepted', 'arrived', 'in_progress', 'paid', 'completed', 'cancelled'], 
    default: 'searching' 
  },
  
  isPaid: { type: Boolean, default: false },
  completionCode: { type: String }, // The 4-digit OTP
  passengerRating: {
    score: { type: Number, min: 1, max: 5 },
    review: { type: String, maxlength: 280 },
    ratedAt: { type: Date }
  },
  captainRating: {
    score: { type: Number, min: 1, max: 5 },
    review: { type: String, maxlength: 280 },
    ratedAt: { type: Date }
  },
  adminActions: [
    {
      action: { type: String, enum: ['force_cancel', 'requeue', 'dispute_resolve'] },
      note: { type: String, maxlength: 220 },
      byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      byEmail: { type: String },
      at: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);