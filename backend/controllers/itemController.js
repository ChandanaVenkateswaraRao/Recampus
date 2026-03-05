const Item = require('../models/Item');
const User = require('../models/User');

// 1. Student: List an Item (Initial state: Pending)
exports.listItem = async (req, res) => {
  try {
    const newItem = new Item({ ...req.body, seller: req.user.id });
    await newItem.save();
    res.status(201).json({ message: "Item listed and sent to Admin for validation.", newItem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Admin: Validate Listing (Approve or Hold with price suggestion)
exports.adminValidate = async (req, res) => {
  try {
    const { status, suggestedPrice } = req.body; // status can be 'approved' or 'hold'
    const item = await Item.findByIdAndUpdate(
      req.params.id, 
      { status, suggestedPrice }, 
      { returnDocument: 'after' } // <--- NEW WAY
    );
    res.json({ message: `Item is now ${status}`, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Seller: Accept Admin's Suggested Price
exports.acceptPrice = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (item.seller.toString() !== req.user.id) return res.status(403).send("Unauthorized");

    item.price = item.suggestedPrice;
    item.status = 'approved'; // Item is now published
    await item.save();
    res.json({ message: "Price accepted. Item is now live.", item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. Buyer: Simulate In-App Payment
exports.purchaseItem = async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // Unique verification code
    const item = await Item.findByIdAndUpdate(req.params.id, {
      buyer: req.user.id,
      verificationCode: code,
      isPaid: true
    }, { returnDocument: 'after' });

    res.json({ 
      message: "Payment simulated successfully. Show this code to the seller during physical collection.",
      verificationCode: code 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. Seller: Verify Handover Code & Release Payout
exports.verifyHandover = async (req, res) => {
  try {
    const { itemId, code } = req.body;
    const item = await Item.findById(itemId);

    if (item.verificationCode === code) {
      const commission = 0.05; // 5% Recampus commission
      const payout = item.price * (1 - commission);

      // Add payout to Seller's simulated wallet
      await User.findByIdAndUpdate(item.seller, { $inc: { walletBalance: payout } });
      
      item.status = 'sold';
      await item.save();

      res.json({ message: "Code verified! Payout released to your wallet (minus 5% fee)." });
    } else {
      res.status(400).json({ message: "Invalid verification code." });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};