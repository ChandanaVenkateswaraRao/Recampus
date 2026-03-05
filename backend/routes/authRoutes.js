const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, checkRole } = require('../middleware/authMiddleware'); 
const jwt = require('jsonwebtoken');
// --- MODELS NEEDED ---
const User = require('../models/User'); 
const Item = require('../models/Item'); // Added missing import
const Ride = require('../models/Ride'); // Added missing import

// --- STANDARD AUTH ROUTES ---
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', auth, authController.getProfile);
router.patch('/update-phone', auth, authController.updatePhone);

// --- CRYPTO WALLET ROUTES ---

// 1. Update logged-in user's wallet
router.patch('/update-wallet', auth, async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).send("Wallet address is required");
    }

    const user = await User.findByIdAndUpdate(
      req.user.id, 
      { cryptoWalletAddress: walletAddress }, 
      { returnDocument: 'after' } // Fixed deprecation warning
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error("Wallet Update Error:", err); 
    res.status(500).send("Server Error");
  }
});

// 2. Get a specific seller's wallet (Needed for Crypto Purchase fallback)
router.get('/get-wallet/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('cryptoWalletAddress');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ wallet: user.cryptoWalletAddress });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// --- RIDE MODULE ROUTES ---

// Register as a Captain/Rider
// --- PROMOTE STUDENT TO RIDER ---
router.post('/become-rider', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.roles.includes('rider')) {
      user.roles.push('rider');
      await user.save();
    }

    // --- CRITICAL: GENERATE A NEW TOKEN WITH UPDATED ROLES ---
    const newToken = jwt.sign(
      { id: user._id, roles: user.roles, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return the new token so the frontend can update it
    res.json({ 
      message: "You are now a KARE Captain!", 
      token: newToken, 
      roles: user.roles 
    });
  } catch (err) {
    res.status(500).send("Error promoting user");
  }
});

// --- ADMIN ROUTES ---

// Get Dashboard Statistics
router.get('/admin/stats', auth, checkRole(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const pendingItems = await Item.countDocuments({ status: 'pending' });
    const activeRides = await Ride.countDocuments({ status: { $ne: 'completed' } });
    
    // Calculate total commission from sold items (5% of price)
    const soldItems = await Item.find({ status: 'sold' });
    const totalCommission = soldItems.reduce((acc, item) => acc + (item.price * 0.05), 0);

    res.json({
      totalUsers,
      pendingItems,
      activeRides,
      totalCommission
    });
  } catch (err) {
    console.error("Admin Stats Error:", err);
    res.status(500).send("Stats error");
  }
});

module.exports = router;