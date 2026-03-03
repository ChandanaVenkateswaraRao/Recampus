const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const User = require('../models/User');
const { auth, checkRole } = require('../middleware/authMiddleware');

// 1. Passenger requests a ride
router.post('/request', auth, async (req, res) => {
  try {
    const existing = await Ride.findOne({ passenger: req.user.id, status: { $in: ['searching', 'accepted', 'paid'] } });
    if (existing) return res.status(400).json({ message: "You already have an active ride." });

    const ride = new Ride({ ...req.body, passenger: req.user.id });
    await ride.save();
    
    // Return populated so UI has email instantly
    const populatedRide = await Ride.findById(ride._id).populate('passenger', 'email');
    res.status(201).json(populatedRide);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Fetch my active ride (Works for both Passenger and Captain)
router.get('/my-active', auth, async (req, res) => {
  try {
    const ride = await Ride.findOne({ 
      $or: [{ passenger: req.user.id }, { captain: req.user.id }], 
      status: { $in: ['searching', 'accepted', 'paid'] } 
    }).populate('passenger', 'email').populate('captain', 'email');
    res.json(ride);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Captain views Radar
router.get('/requests', auth, checkRole(['rider']), async (req, res) => {
  try {
    const rides = await Ride.find({ status: 'searching' }).populate('passenger', 'email');
    res.json(rides);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Captain accepts ride
router.patch('/accept/:id', auth, checkRole(['rider']), async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(
      req.params.id, 
      { status: 'accepted', captain: req.user.id },
      { returnDocument: 'after' }
    ).populate('passenger', 'email').populate('captain', 'email');
    res.json(ride);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Passenger pays (Generates OTP)
router.post('/pay/:id', auth, async (req, res) => {
  try {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const ride = await Ride.findByIdAndUpdate(
      req.params.id, 
      { status: 'paid', isPaid: true, completionCode: otp },
      { returnDocument: 'after' }
    ).populate('passenger', 'email').populate('captain', 'email');
    res.json({ message: "Paid successfully", code: otp, ride });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Captain enters OTP to finish
router.post('/verify-completion', auth, checkRole(['rider']), async (req, res) => {
  try {
    const { rideId, code } = req.body;
    const ride = await Ride.findById(rideId);

    if (ride.completionCode === code) {
      const payout = ride.price * 0.90; // 10% Platform commission
      await User.findByIdAndUpdate(req.user.id, { $inc: { walletBalance: payout } });
      
      ride.status = 'completed';
      await ride.save();
      res.json({ message: "Ride Completed! Funds released." });
    } else {
      res.status(400).json({ message: "Invalid Handover Code." });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Cancel Ride
router.patch('/cancel/:id', auth, async (req, res) => {
  try {
    await Ride.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.json({ message: "Ride cancelled" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;