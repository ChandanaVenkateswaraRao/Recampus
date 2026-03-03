const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User'); // Import User just in case
const { auth, checkRole } = require('../middleware/authMiddleware');
const { ethers } = require('ethers');

// 1. LIST ITEM (Student)
router.post('/list', auth, async (req, res) => {
  try {
    // Get seller's phone from User profile if not provided in form (Optional fallback)
    const newItem = new Item({ 
      ...req.body, 
      seller: req.user.id 
    });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. BROWSE ITEMS (Public - Fixes your issue)
router.get('/browse', async (req, res) => {
  try {
    // CRITICAL FIX: .populate() turns the ID string into a User Object
    // We explicitly ask for 'email' and 'cryptoWalletAddress'
    const items = await Item.find({ status: 'approved' })
      .populate('seller', 'email cryptoWalletAddress'); 
      
    res.json(items);
  } catch (err) {
    console.error("Browse Error:", err);
    res.status(500).json({ message: "Error fetching items" });
  }
});

// 3. ADMIN: GET PENDING
router.get('/admin/pending', auth, checkRole(['admin']), async (req, res) => {
  try {
    const items = await Item.find({ status: 'pending' }).populate('seller', 'email');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// --- GET SELLER WALLET (Public/Protected) ---
router.get('/get-wallet/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('cryptoWalletAddress');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ wallet: user.cryptoWalletAddress });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// 4. ADMIN: VALIDATE
router.patch('/admin/validate/:id', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { status, suggestedPrice } = req.body;
    const item = await Item.findByIdAndUpdate(
      req.params.id, 
      { status, suggestedPrice }, 
      { returnDocument: 'after' }
    );
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. BUY (Simulated / Standard)
router.post('/buy/:id', auth, async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const item = await Item.findByIdAndUpdate(req.params.id, {
      buyer: req.user.id,
      verificationCode: code,
      isPaid: true
    }, { returnDocument: 'after' });
    res.json({ message: "Payment successful", code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. BUY (Crypto Record)
// --- BUY WITH CRYPTO (Corrected) ---
router.post('/buy-crypto', auth, async (req, res) => {
  const { itemId, txHash } = req.body;
  
  console.log(`Processing Crypto Buy for Item: ${itemId} | Hash: ${txHash}`);

  try {
    // 1. Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Find and Update the Item
    const item = await Item.findByIdAndUpdate(
      itemId, 
      {
        buyer: req.user.id,        // Link the logged-in buyer
        verificationCode: code,    // Save the OTP
        isPaid: true,              // Mark as paid
        transactionHash: txHash,   // Save proof
        status: 'pending_handover' // Change status
      }, 
      { returnDocument: 'after' }
    );

    if (!item) {
      console.error("Item not found during update");
      return res.status(404).json({ message: "Item not found" });
    }

    console.log("Database Updated Successfully. OTP:", code);
    
    // 3. Return the code so Frontend can show it
    res.json({ message: "Crypto Payment Recorded", code, item });

  } catch (err) {
    console.error("Crypto Route Error:", err); // Watch your backend terminal for this!
    res.status(500).json({ error: err.message });
  }
});

// 7. VERIFY HANDOVER
router.post('/verify-handover', auth, async (req, res) => {
  try {
    const { itemId, code } = req.body;
    
    // 1. Populate Seller to get their Wallet Address
    const item = await Item.findById(itemId).populate('seller', 'cryptoWalletAddress email');

    if (item.verificationCode === code) {
      
      // --- CRYPTO PAYOUT LOGIC ---
      if (item.transactionHash) { // Only do this if it was a Crypto Buy
        console.log("Initiating Crypto Payout to Seller:", item.seller.cryptoWalletAddress);

        try {
          // A. Setup Provider (Sepolia Testnet)
          // You can use a public RPC URL like Alchemy or Infura
          const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");

          // B. Create Wallet from Private Key
          const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

          // C. Calculate Amount (Price - 5% Commission)
          // Note: In production, use Oracle for Price. Here we assume 1 INR = 0.000004 ETH constant
          const exchangeRate = 0.000004; 
          const payoutEth = (item.price * 0.95 * exchangeRate).toFixed(18);

          // D. Send Transaction (Admin -> Seller)
          const tx = await adminWallet.sendTransaction({
            to: item.seller.cryptoWalletAddress,
            value: ethers.parseEther(payoutEth)
          });

          console.log("Payout Sent! Hash:", tx.hash);
          
          // E. Save Payout Hash (Optional: Add payoutHash to Item schema)
          // item.payoutHash = tx.hash; 

        } catch (cryptoError) {
          console.error("Crypto Payout Failed:", cryptoError);
          return res.status(500).json({ message: "Code matched, but Crypto Payout failed. Contact Admin." });
        }
      }
      // ---------------------------

      // 2. Standard Database Updates
      const commission = 0.05; 
      const payout = item.price * (1 - commission);
      await User.findByIdAndUpdate(item.seller._id, { $inc: { walletBalance: payout } }); // Update simulated balance too
      
      item.status = 'sold';
      await item.save();
      
      res.json({ message: "Transaction completed. Crypto released to your wallet." });
    } else {
      res.status(400).json({ message: "Invalid code." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 8. ACCEPT PRICE SUGGESTION
router.patch('/accept-suggestion/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if(item.seller.toString() !== req.user.id) return res.status(403).send("Unauthorized");
    
    item.price = item.suggestedPrice;
    item.status = 'approved';
    await item.save();
    res.json(item);
  } catch(err) {
    res.status(500).send("Error");
  }
});



// --- TOGGLE WISHLIST ---
router.post('/wishlist/toggle/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const itemId = req.params.id;

    // Check if already in wishlist
    const index = user.wishlist.indexOf(itemId);
    
    if (index === -1) {
      user.wishlist.push(itemId); // Add
      await user.save();
      res.json({ message: "Added to wishlist", isLiked: true });
    } else {
      user.wishlist.splice(index, 1); // Remove
      await user.save();
      res.json({ message: "Removed from wishlist", isLiked: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET MY WISHLIST ---
router.get('/wishlist/my', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist');
    res.json(user.wishlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST A QUESTION (Buyer) ---
// --- POST QUESTION ROUTE ---
// --- POST A QUESTION ---
// --- POST A QUESTION ---
router.post('/question/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).send("Item not found");

    // FIX: Fetch the user details to get the email/name
    const user = await User.findById(req.user.id); // Ensure User is imported at top

    item.questions.push({
      userId: req.user.id,
      username: user.email.split('@')[0], // Now user.email is guaranteed to exist
      question: req.body.question
    });

    await item.save();
    res.json(item.questions);
  } catch (err) {
    console.error("Question Error:", err);
    res.status(500).send(err.message);
  }
});
// --- ANSWER A QUESTION (Seller Only) ---
router.post('/answer/:itemId/:questionId', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    
    // Security Check: Only the seller can answer
    if (item.seller.toString() !== req.user.id) {
      return res.status(403).send("Only the seller can reply.");
    }

    // Find the specific question and update answer
    const question = item.questions.id(req.params.questionId);
    if (!question) return res.status(404).send("Question not found");
    
    question.answer = req.body.answer;
    
    await item.save();
    res.json(item.questions);
  } catch (err) {
    console.error("Answer Error:", err);
    res.status(500).send(err.message);
  }
});

// --- SELLER CONTROLS ---

// 1. Delete Listing
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).send("Item not found");
    if (item.seller.toString() !== req.user.id) return res.status(403).send("Unauthorized");
    if (item.isPaid) return res.status(400).send("Cannot delete an item that is already paid for in Escrow.");

    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 2. Mark as Sold Offline
router.patch('/sold-offline/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).send("Item not found");
    if (item.seller.toString() !== req.user.id) return res.status(403).send("Unauthorized");
    if (item.isPaid) return res.status(400).send("Cannot mark as sold offline. Buyer already paid.");

    item.status = 'sold'; // Closes the listing
    await item.save();
    res.json({ message: "Marked as sold offline." });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 3. Edit Listing (Sends back to Admin for approval)
router.patch('/edit/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).send("Item not found");
    if (item.seller.toString() !== req.user.id) return res.status(403).send("Unauthorized");
    if (item.isPaid) return res.status(400).send("Cannot edit an item that is already paid for.");

    // Update fields and send back to pending
    item.title = req.body.title || item.title;
    item.description = req.body.description || item.description;
    item.price = req.body.price || item.price;
    item.status = 'pending'; // Requires Admin re-validation since price/details changed
    
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- INCREMENT VIEW COUNTER ---
router.patch('/view/:id', async (req, res) => {
  try {
    // $inc is a MongoDB operator that increases a number field
    const item = await Item.findByIdAndUpdate(
      req.params.id, 
      { $inc: { views: 1 } }, 
      { returnDocument: 'after' }
    );
    res.json({ views: item.views });
  } catch (err) {
    // We don't want a failed view count to crash the frontend, so just return 200
    res.status(200).send("Silently failed to update views"); 
  }
});

router.post('/buy/:id', auth, async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const item = await Item.findByIdAndUpdate(req.params.id, {
      buyer: req.user.id,
      verificationCode: code,
      isPaid: true
    }, { returnDocument: 'after' });

    // --- NEW: REAL-TIME NOTIFICATION LOGIC ---
    const io = req.app.get('io');
    const activeUsers = req.app.get('activeUsers');

    // 1. Save to Database
    const notif = new Notification({
      userId: item.seller, // Send to the seller
      message: `🎉 Great news! Someone just paid ₹${item.price} for your "${item.title}". Check your Sales tab!`,
      type: 'sale'
    });
    await notif.save();

    // 2. Check if Seller is online right now
    const sellerSocketId = activeUsers.get(item.seller.toString());
    if (sellerSocketId) {
      // 3. Blast the notification directly to their screen!
      io.to(sellerSocketId).emit('new_notification', notif);
    }
    // ------------------------------------------

    res.json({ message: "Payment successful", code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;