const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/email');

/* =========================
   REGISTER + SEND OTP
========================= */

exports.register = async (req, res) => {
  try {

    const { email, password, phone } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPhone = String(phone || '').trim();

    if (!normalizedEmail.endsWith('@klu.ac.in')) {
      return res.status(403).json({
        message: 'Only @klu.ac.in emails are allowed.'
      });
    }

    if (!/^\+?[0-9]{10,15}$/.test(normalizedPhone)) {
      return res.status(400).json({
        message: 'Please provide a valid phone number (10-15 digits).'
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        message: 'User already registered.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = new User({
      email: normalizedEmail,
      password: hashedPassword,
      phone: normalizedPhone,
      roles: ['student'],
      emailVerified: false,
      emailOTP: otp,
      emailOTPExpires: Date.now() + 10 * 60 * 1000
    });

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "ReCampus Email Verification Code",
      text: `Your verification code is ${otp}. It expires in 10 minutes.`
    });

    return res.status(201).json({
      message: "Verification code sent",
      email: user.email
    });

  } catch (err) {

  if (err.code === 11000) {
    return res.status(400).json({
      message: "User already registered with this email."
    });
  }

  console.error(err);

  return res.status(500).json({
    message: "Server error"
  });
}
};


/* =========================
   VERIFY EMAIL OTP
========================= */

exports.verifyEmail = async (req, res) => {

  try {

    const { email, code } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    if (user.emailVerified) {
      return res.json({
        message: 'Email already verified.'
      });
    }

    if (!user.emailOTP || user.emailOTP !== code) {
      return res.status(400).json({
        message: 'Invalid verification code.'
      });
    }

    if (user.emailOTPExpires < Date.now()) {
      return res.status(400).json({
        message: 'OTP expired.'
      });
    }

    user.emailVerified = true;
    user.emailOTP = null;
    user.emailOTPExpires = null;

    await user.save();

    return res.json({
      message: 'Email verified successfully.'
    });

  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }

};


/* =========================
   RESEND OTP
========================= */

exports.resendVerification = async (req, res) => {
  try {

    const { email } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        message: "Email already verified."
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.emailOTP = otp;
    user.emailOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "ReCampus Verification Code",
      text: `Your new verification code is ${otp}. It expires in 10 minutes.`
    });

    return res.json({
      message: "OTP sent again successfully."
    });

  } catch (err) {

    console.error("Resend OTP Error:", err);

    return res.status(500).json({
      message: "Server error"
    });

  }
};


/* =========================
   LOGIN
========================= */

exports.login = async (req, res) => {

  try {

    const { email, password } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials."
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in."
      });
    }

    const token = jwt.sign(
      { id: user._id, roles: user.roles },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        roles: user.roles,
        balance: user.walletBalance || 0
      }
    });

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }

};


/* =========================
   BECOME RIDER
========================= */

exports.becomeRider = async (req, res) => {

  try {

    const user = await User.findById(req.user.id);

    if (!user.roles.includes('rider')) {
      user.roles.push('rider');
      await user.save();
    }

    return res.json({
      message: "You are now a registered Captain!",
      roles: user.roles
    });

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }

};


/* =========================
   GET PROFILE
========================= */

exports.getProfile = async (req, res) => {

  try {

    const user = await User.findById(req.user.id).select('-password');

    return res.json(user);

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }

};


/* =========================
   UPDATE PHONE
========================= */

exports.updatePhone = async (req, res) => {

  try {

    const normalizedPhone = String(req.body?.phone || '').trim();

    if (!/^\+?[0-9]{10,15}$/.test(normalizedPhone)) {
      return res.status(400).json({
        message: 'Please provide a valid phone number.'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { phone: normalizedPhone },
      { new: true }
    ).select('-password');

    return res.json({
      message: 'Phone updated successfully.',
      user
    });

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }

};