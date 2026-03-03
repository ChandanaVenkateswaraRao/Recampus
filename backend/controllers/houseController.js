const House = require('../models/House');

// 1. Admin: Create a House Listing
exports.createHouse = async (req, res) => {
  try {
    const newHouse = new House(req.body);
    await newHouse.save();
    res.status(201).json({ message: "House listing published by Admin.", newHouse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Student: Browse All Houses (Phone numbers are masked)
exports.getAllHouses = async (req, res) => {
  try {
    const houses = await House.find({ isAvailable: true }).select('-ownerPhone'); 
    // .select('-ownerPhone') ensures the phone is NOT sent in the list
    res.json(houses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Student: Book/View House (Simulated Payment)
exports.bookHouse = async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) return res.status(404).json({ message: "House not found" });

    // Simulate payment logic here
    // Once "paid", we add the user to the unlockedBy array
    if (!house.unlockedBy.includes(req.user.id)) {
      house.unlockedBy.push(req.user.id);
      await house.save();
    }

    res.json({ 
      message: "Payment successful. Owner details unlocked.", 
      ownerPhone: house.ownerPhone, 
      ownerName: house.ownerName 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. Admin: Mark as Rented/Unavailable
exports.toggleAvailability = async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    house.isAvailable = !house.isAvailable;
    await house.save();
    res.json({ message: "Availability status updated.", isAvailable: house.isAvailable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};