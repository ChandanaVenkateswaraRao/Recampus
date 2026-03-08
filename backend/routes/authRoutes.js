const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { auth, checkRole } = require('../middleware/authMiddleware');

const jwt = require('jsonwebtoken');

// Models
const User = require('../models/User');
const Item = require('../models/Item');
const Ride = require('../models/Ride');


/* ===============================
   AUTH ROUTES
================================ */

// Register (send OTP)
router.post('/register', authController.register);

// Verify email OTP
router.post('/verify-email', authController.verifyEmail);

// Resend OTP
router.post('/resend-verification', authController.resendVerification);

// Login
router.post('/login', authController.login);

// Profile
router.get('/profile', auth, authController.getProfile);

// Update phone
router.patch('/update-phone', auth, authController.updatePhone);


/* ===============================
   CRYPTO WALLET ROUTES
================================ */

// Update logged-in user's wallet
router.patch('/update-wallet', auth, async (req, res) => {
  try {

    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        message: "Wallet address is required"
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { cryptoWalletAddress: walletAddress },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.json(user);

  } catch (err) {

    console.error("Wallet Update Error:", err);
    return res.status(500).json({
      message: "Server Error"
    });

  }
});


// Get seller wallet
router.get('/get-wallet/:userId', auth, async (req, res) => {
  try {

    const user = await User
      .findById(req.params.userId)
      .select('cryptoWalletAddress');

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.json({
      wallet: user.cryptoWalletAddress
    });

  } catch (err) {

    console.error("Wallet Fetch Error:", err);
    return res.status(500).json({
      message: "Server Error"
    });

  }
});


/* ===============================
   RIDE MODULE ROUTES
================================ */

// Promote student to rider
router.post('/become-rider', auth, async (req, res) => {

  try {

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (!user.roles.includes('rider')) {
      user.roles.push('rider');
      await user.save();
    }

    const newToken = jwt.sign(
      {
        id: user._id,
        roles: user.roles,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      message: "You are now a KARE Captain!",
      token: newToken,
      roles: user.roles
    });

  } catch (err) {

    console.error("Promote Rider Error:", err);
    return res.status(500).json({
      message: "Error promoting user"
    });

  }

});


/* ===============================
   ADMIN ROUTES
================================ */

router.get('/admin/stats', auth, checkRole(['admin']), async (req, res) => {

  try {

    const totalUsers = await User.countDocuments();

    const pendingItems = await Item.countDocuments({
      status: 'pending'
    });

    const activeRides = await Ride.countDocuments({
      status: { $ne: 'completed' }
    });

    const soldItems = await Item.find({ status: 'sold' });

    const totalCommission = soldItems.reduce(
      (acc, item) => acc + (item.price * 0.05),
      0
    );

    return res.json({
      totalUsers,
      pendingItems,
      activeRides,
      totalCommission
    });

  } catch (err) {

    console.error("Admin Stats Error:", err);
    return res.status(500).json({
      message: "Stats error"
    });

  }

});


module.exports = router;