const Ride = require('../models/Ride');
const User = require('../models/User');

// --- PASSENGER LOGIC ---

// 1. Create a Ride Request (Pre-booking or On-spot)
exports.requestRide = async (req, res) => {
  try {
    const { type, route, startLocation, destination, price } = req.body;
    const ride = new Ride({
      passenger: req.user.id,
      type,
      route,
      startLocation,
      destination,
      price,
      status: 'searching'
    });
    await ride.save();
    res.status(201).json({ message: "Ride request broadcasted to captains.", ride });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Passenger Pays (Simulated)
exports.payForRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).populate('captain', 'email');
    if (!ride.captain) return res.status(400).json({ message: "No captain has accepted this ride yet." });

    const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
    ride.isPaid = true;
    ride.status = 'paid';
    ride.completionCode = code;
    // Reveal captain's email (contact) only now
    ride.captainContact = ride.captain.email; 
    
    await ride.save();
    res.json({ message: "Payment successful. Contact your captain.", captainContact: ride.captainContact, code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- CAPTAIN LOGIC ---

// 3. Captain: Browse available requests
exports.getOpenRequests = async (req, res) => {
  try {
    const rides = await Ride.find({ status: 'searching' }).populate('passenger', 'email');
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. Captain: Accept a Ride
exports.acceptRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (ride.status !== 'searching') return res.status(400).json({ message: "Ride already taken." });

    ride.captain = req.user.id;
    ride.status = 'accepted';
    await ride.save();
    res.json({ message: "Ride accepted. Waiting for passenger payment.", ride });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. Captain: Complete Ride (Enter code given by passenger)
exports.verifyRideCompletion = async (req, res) => {
  try {
    const { rideId, code } = req.body;
    const ride = await Ride.findById(rideId);

    if (ride.completionCode === code) {
      const commission = 0.10; // 10% platform fee for rides
      const payout = ride.price * (1 - commission);

      await User.findByIdAndUpdate(ride.captain, { $inc: { walletBalance: payout } });
      ride.status = 'completed';
      await ride.save();

      res.json({ message: "Ride completed. Funds added to your wallet." });
    } else {
      res.status(400).json({ message: "Invalid completion code." });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};