const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Strict Domain Validation
    if (!email.endsWith('@klu.ac.in')) {
      return res.status(403).json({ message: "Only @klu.ac.in emails are allowed." });
    }

    // 2. Check if user already exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already registered." });

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create User (Default role: student)
    user = new User({
      email,
      password: hashedPassword,
      roles: ['student'] 
    });

    await user.save();

    // 5. Generate JWT
    const token = jwt.sign(
      { id: user._id, roles: user.roles },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, user: { email: user.email, roles: user.roles } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

    const token = jwt.sign(
      { id: user._id, roles: user.roles },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user._id,
        email: user.email, 
        roles: user.roles,
        balance: user.walletBalance 
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add to authController.js
exports.becomeRider = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.roles.includes('rider')) {
      user.roles.push('rider');
      await user.save();
    }
    res.json({ message: "You are now a registered Captain!", roles: user.roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};