const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Item = require('../models/Item');
const Ride = require('../models/Ride');

// GET /api/admin/stats
router.get('/stats', auth, checkRole(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const pendingItems = await Item.countDocuments({ status: 'pending' });
    const activeRides = await Ride.countDocuments({ status: { $ne: 'completed' } });
    
    // Calculate total commission (5% of sold items + 10% of completed rides)
    const soldItems = await Item.find({ status: 'sold' });
    const completedRides = await Ride.find({ status: 'completed' });
    
    const itemCommission = soldItems.reduce((acc, item) => acc + (item.price * 0.05), 0);
    const rideCommission = completedRides.reduce((acc, ride) => acc + (ride.price * 0.10), 0);

    res.json({
      totalUsers,
      pendingItems,
      activeRides,
      totalCommission: itemCommission + rideCommission
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error calculating stats" });
  }
});

module.exports = router;